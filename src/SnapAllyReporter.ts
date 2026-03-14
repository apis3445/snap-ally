import { Reporter, TestCase, TestResult, FullResult, FullConfig } from '@playwright/test/reporter';
import { ReportData, TestResults, TestSummary, TestStatusIcon, A11yError } from './models';
import { A11yReportAssets } from './A11yReportAssets';
import { A11yHtmlRenderer } from './A11yHtmlRenderer';
import { A11yTimeUtils } from './A11yTimeUtils';
import * as path from 'path';
import * as fs from 'fs';

// ────────────────────────────────────────────────────────────────────────────
//  Public options interface
// ────────────────────────────────────────────────────────────────────────────

export interface AccessibilityReporterOptions {
    /**
     * Folder where the reports will be generated.
     * @default "steps-report"
     */
    outputFolder?: string;

    /**
     * Custom colors for violation severities in the report.
     */
    colors?: {
        critical?: string;
        serious?: string;
        moderate?: string;
        minor?: string;
    };

    /**
     * Azure DevOps integration options.
     */
    ado?: {
        organization?: string;
        project?: string;
        areaPath?: string;
    };
}

// ────────────────────────────────────────────────────────────────────────────
//  Internal types
// ────────────────────────────────────────────────────────────────────────────

/** Resolved severity color palette (no more optional chaining everywhere). */
interface ResolvedColors {
    critical: string;
    serious: string;
    moderate: string;
    minor: string;
}

/** Default severity colors used when the user doesn't override them. */
const DEFAULT_COLORS: Readonly<ResolvedColors> = {
    critical: '#c92a2a',
    serious: '#e67700',
    moderate: '#ca8a04',
    minor: '#0891b2',
};

/** Union of the two shapes that can carry A11y data. */
type A11yDataSource =
    | { type: 'attachment'; data: { name: string; body?: Buffer; path?: string } }
    | { type: 'annotation'; data: { type: string; description?: string } };

// ────────────────────────────────────────────────────────────────────────────
//  Reporter
// ────────────────────────────────────────────────────────────────────────────

/**
 * Playwright reporter for accessibility audits and test steps.
 *
 * Generates:
 * - A per-test execution report (steps, video, screenshots, errors)
 * - A per-scan accessibility report (violations, evidence, ADO integration)
 * - A global execution summary with per-browser breakdowns
 */
class SnapAllyReporter implements Reporter {
    private readonly outputFolder: string;
    private readonly assetsManager = new A11yReportAssets();
    private readonly renderer = new A11yHtmlRenderer();
    private readonly options: AccessibilityReporterOptions;
    private readonly colors: ResolvedColors;

    private projectRoot = 'tests';

    /**
     * Monotonically increasing test counter.
     * Incremented synchronously in {@link onTestEnd} to avoid race conditions
     * when multiple async {@link processTestResult} calls run concurrently.
     */
    private testIndex = 0;

    /** Async tasks queued by `onTestEnd`; drained in `onEnd`. */
    private readonly tasks: Promise<void>[] = [];

    /** Aggregated data for the final summary report. */
    private readonly executionSummary: TestSummary = {
        duration: '',
        status: '',
        statusIcon: '',
        total: 0,
        totalFailed: 0,
        totalFlaky: 0,
        totalPassed: 0,
        totalSkipped: 0,
        groupedResults: {},
        wcagErrors: {},
        totalA11yErrorCount: 0,
        browserSummaries: {},
        date: '',
    };

    constructor(options: AccessibilityReporterOptions = {}) {
        this.options = options;
        this.outputFolder = path.resolve(process.cwd(), options.outputFolder || 'steps-report');
        this.colors = {
            critical: options.colors?.critical || DEFAULT_COLORS.critical,
            serious: options.colors?.serious || DEFAULT_COLORS.serious,
            moderate: options.colors?.moderate || DEFAULT_COLORS.moderate,
            minor: options.colors?.minor || DEFAULT_COLORS.minor,
        };
    }

    printsToStdio(): boolean {
        return false;
    }

    onBegin(config: FullConfig): void {
        this.projectRoot = config.rootDir || 'tests';
    }

    onTestEnd(test: TestCase, result: TestResult): void {
        // Increment index synchronously so concurrent tasks never share an index.
        const index = ++this.testIndex;
        this.tasks.push(this.processTestResult(test, result, index));
    }

    async onEnd(result: FullResult): Promise<void> {
        await Promise.all(this.tasks);

        this.executionSummary.duration = A11yTimeUtils.formatDuration(result.duration);
        this.executionSummary.status = result.status;
        this.executionSummary.statusIcon =
            TestStatusIcon[result.status as keyof typeof TestStatusIcon] || 'help';
        this.executionSummary.date = A11yTimeUtils.formatDate(new Date());

        const summaryFile = path.join(this.outputFolder, 'summary.html');
        await this.renderer.render(
            'execution-summary.html',
            { ...this.executionSummary, colors: this.colors },
            this.outputFolder,
            summaryFile
        );

        console.log(`\n[SnapAlly] Reports generated in: ${path.resolve(this.outputFolder)}`);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  Core per-test processing
    // ────────────────────────────────────────────────────────────────────────

    private async processTestResult(
        test: TestCase,
        result: TestResult,
        index: number
    ): Promise<void> {
        const sanitizedTitle = test.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        const testFolderName = `${index}-${sanitizedTitle}`;
        const testResultsFolder = path.join(this.outputFolder, testFolderName);

        const fileGroup = path.relative(this.projectRoot, test.location.file);
        this.ensureGroupExists(fileGroup);

        const browser = this.resolveBrowser(test);
        const testMeta = this.extractTestMetadata(test, result);

        // Copy assets
        const video = await this.assetsManager.copyTestVideo(result, testResultsFolder);
        const screenshots = this.assetsManager.copyScreenshots(result, testResultsFolder);
        const allAttachments = [
            ...this.assetsManager.copyPngAttachments(result, testResultsFolder),
            ...this.assetsManager.copyAllOtherAttachments(result, testResultsFolder),
        ];

        const errorLogs = this.extractErrorLogs(result);

        // Accessibility processing
        const a11yResult = await this.processAccessibilityData(
            test,
            result,
            sanitizedTitle,
            testResultsFolder,
            testMeta.steps,
            video,
            browser,
            errorLogs
        );

        // Update browser & global summary counts
        this.updateBrowserSummary(browser, result.status);
        this.updateGlobalSummary(test, result);

        // Build the test stats object
        const executionReportName = `execution-${sanitizedTitle}.html`;
        const testStats: TestResults = {
            num: index,
            folderName: testFolderName,
            executionReportPath: `${testFolderName}/${executionReportName}`,
            title: test.title,
            fileName: fileGroup,
            timeDuration: result.duration,
            duration: A11yTimeUtils.formatDuration(result.duration),
            description: testMeta.description,
            status: result.status,
            browser,
            tags: testMeta.tags,
            preConditions: testMeta.preConditions,
            steps: testMeta.steps,
            postConditions: testMeta.postConditions,
            statusIcon: testMeta.statusIcon,
            pageUrl: a11yResult.pageUrl,
            videoPath: video,
            screenshotPaths: screenshots,
            attachments: allAttachments,
            errors: errorLogs,
            a11yReportPath: a11yResult.reportPath,
            a11yErrorCount: a11yResult.errorCount,
            a11yErrors: a11yResult.errors,
            colors: this.options.colors,
        };

        this.executionSummary.groupedResults[fileGroup].push(testStats);

        // Render the per-test execution report
        const indexFile = path.join(testResultsFolder, executionReportName);
        await this.renderer.render(
            'test-execution-report.html',
            { ...testStats, colors: this.colors },
            testResultsFolder,
            indexFile
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    //  Metadata extraction
    // ────────────────────────────────────────────────────────────────────────

    /** Extracts structured metadata from test annotations and result steps. */
    private extractTestMetadata(test: TestCase, result: TestResult) {
        const tags = test.tags.map((t) => t.replace('@', ''));
        const statusIcon =
            TestStatusIcon[result.status as keyof typeof TestStatusIcon] || 'help';

        const descAnnotation = test.annotations.find((a) => a.type === 'Description');
        const description = descAnnotation?.description || 'No Description';

        const steps = result.steps
            .filter((s) => s.category === 'test.step')
            .map((s) => s.title);

        const preConditions = test.annotations
            .filter((a) => a.type === 'Pre Condition')
            .map((a) => a.description || '');

        const postConditions = test.annotations
            .filter((a) => a.type === 'Post Condition')
            .map((a) => a.description || '');

        return { tags, statusIcon, description, steps, preConditions, postConditions };
    }

    /** Determines the browser name for the current test. */
    private resolveBrowser(test: TestCase): string {
        const project = test.parent.project();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const projectUse = (project?.use as any) || {};

        return (
            project?.name ||
            projectUse.browserName ||
            projectUse.defaultBrowserType ||
            'chromium'
        );
    }

    /** Converts Playwright error objects into HTML-safe strings. */
    private extractErrorLogs(result: TestResult): string[] {
        return (result.errors || []).map((err) => {
            const fullMsg = err.stack
                ? `${err.message}\n${err.stack}`
                : err.message || 'Error occurred';
            return this.renderer.ansiToHtml(fullMsg);
        });
    }

    // ────────────────────────────────────────────────────────────────────────
    //  Accessibility data processing
    // ────────────────────────────────────────────────────────────────────────

    /** Return value for {@link processAccessibilityData}. */
    private async processAccessibilityData(
        test: TestCase,
        result: TestResult,
        sanitizedTitle: string,
        testResultsFolder: string,
        steps: string[],
        video: string,
        browser: string,
        errorLogs: string[]
    ): Promise<{ reportPath?: string; errorCount: number; errors: A11yError[]; pageUrl?: string }> {
        const sources = this.collectA11yDataSources(test, result);

        if (sources.length === 0) {
            return { errorCount: 0, errors: [] };
        }

        let reportPath: string | undefined;
        let errorCount = 0;
        const aggregatedErrors: A11yError[] = [];
        let pageUrl: string | undefined;

        for (const [index, source] of sources.entries()) {
            const reportData = this.parseA11ySource(source, errorLogs);
            if (!reportData) continue;

            const reportName = this.buildA11yReportName(
                sanitizedTitle,
                reportData.pageKey,
                index,
                sources.length
            );
            reportPath = reportName;

            this.applyReportConfig(reportData, video);
            this.backfillSteps(reportData, steps);

            const auditFile = path.join(testResultsFolder, reportName);
            await this.renderer.render(
                'accessibility-report.html',
                { data: reportData, folderTest: testResultsFolder },
                testResultsFolder,
                auditFile
            );

            if (reportData.pageUrl && !pageUrl) {
                pageUrl = reportData.pageUrl;
            }

            // Aggregate a11y errors into browser & global summaries
            if (reportData.a11yErrors?.length) {
                const scanCount = this.aggregateA11yErrors(reportData.a11yErrors, browser);
                errorCount += scanCount;
                aggregatedErrors.push(...reportData.a11yErrors);
            }
        }

        return { reportPath, errorCount, errors: aggregatedErrors, pageUrl };
    }

    /** Collects all A11y data sources (attachments + annotations) for a test. */
    private collectA11yDataSources(test: TestCase, result: TestResult): A11yDataSource[] {
        const attachments = (result.attachments || [])
            .filter((a) => a.name === 'A11y')
            .map((a): A11yDataSource => ({ type: 'attachment', data: a }));

        const annotations = (test.annotations || [])
            .filter((a) => a.type === 'A11y')
            .map((a): A11yDataSource => ({ type: 'annotation', data: a }));

        return [...attachments, ...annotations];
    }

    /** Attempts to parse a single A11y data source into a ReportData object. */
    private parseA11ySource(source: A11yDataSource, errorLogs: string[]): ReportData | null {
        try {
            if (source.type === 'attachment') {
                const attach = source.data;
                if (attach.body) {
                    return JSON.parse(attach.body.toString()) as ReportData;
                }
                if (attach.path && fs.existsSync(attach.path)) {
                    return JSON.parse(fs.readFileSync(attach.path, 'utf-8')) as ReportData;
                }
                return null;
            }

            // annotation
            const annot = source.data;
            return JSON.parse(annot.description || '{}') as ReportData;
        } catch (e) {
            console.error(`[SnapAlly] Failed to parse A11y ${source.type}: ${e}`);
            errorLogs.push(
                this.renderer.ansiToHtml(
                    `[SnapAlly] Internal error parsing accessibility data from ${source.type}: ${e}`
                )
            );
            return null;
        }
    }

    /** Generates a sanitized HTML filename for an accessibility report. */
    private buildA11yReportName(
        sanitizedTitle: string,
        pageKey: string | undefined,
        index: number,
        totalScans: number
    ): string {
        const hasMultiple = totalScans > 1;
        const suffix = hasMultiple ? `-${index + 1}` : '';

        if (pageKey) {
            const sanitizedKey = pageKey
                .replace(/https?:\/\//, '')
                .replace(/[^a-z0-9]+/gi, '-')
                .replace(/^-+|-+$/g, '')
                .toLowerCase();

            if (sanitizedKey) {
                return `${sanitizedKey}${suffix}.html`;
            }
        }

        return `accessibility-${sanitizedTitle}${suffix}.html`;
    }

    /** Applies reporter-level configuration (colors, ADO, video) to a ReportData object. */
    private applyReportConfig(reportData: ReportData, video: string): void {
        reportData.criticalColor = this.colors.critical;
        reportData.seriousColor = this.colors.serious;
        reportData.moderateColor = this.colors.moderate;
        reportData.minorColor = this.colors.minor;

        if (this.options.ado) {
            reportData.adoOrganization =
                this.options.ado.organization || reportData.adoOrganization;
            reportData.adoProject = this.options.ado.project || reportData.adoProject;
            if (this.options.ado.areaPath) {
                reportData.adoAreaPath = this.options.ado.areaPath;
            }
        }

        if (video) {
            reportData.video = video;
        }
    }

    /**
     * Backfills reproduction steps from `test.step` calls into a11y targets
     * that have no steps recorded (e.g. violations found via static scan).
     */
    private backfillSteps(reportData: ReportData, steps: string[]): void {
        const filteredSteps = steps.filter((s) => !s.includes('Capture A11y screenshot'));
        if (filteredSteps.length === 0) return;

        for (const err of reportData.a11yErrors) {
            for (const target of err.target) {
                if (!target.steps || target.steps.length === 0) {
                    target.steps = filteredSteps;
                    target.stepsJson = JSON.stringify(filteredSteps);
                }
            }
        }
    }

    // ──────────────────────────────���─────────────────────────────────────────
    //  Summary aggregation
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Aggregates a11y error counts into both the browser-specific and global
     * summaries. Returns the total error count for this scan.
     */
    private aggregateA11yErrors(errors: A11yError[], browser: string): number {
        const bSummary = this.getOrCreateBrowserSummary(browser);
        let scanErrorCount = 0;

        for (const err of errors) {
            const count = err.total || 0;
            scanErrorCount += count;

            // Browser-level aggregation
            if (!bSummary.wcagErrors[err.id]) {
                bSummary.wcagErrors[err.id] = {
                    count: 0,
                    severity: err.severity,
                    helpUrl: err.helpUrl,
                    description: err.description,
                };
            }
            bSummary.wcagErrors[err.id].count += count;

            // Global aggregation
            if (!this.executionSummary.wcagErrors[err.id]) {
                this.executionSummary.wcagErrors[err.id] = {
                    count: 0,
                    severity: err.severity,
                    helpUrl: err.helpUrl,
                    description: err.description,
                };
            }
            this.executionSummary.wcagErrors[err.id].count += count;
        }

        bSummary.totalA11yErrorCount += scanErrorCount;
        this.executionSummary.totalA11yErrorCount += scanErrorCount;

        return scanErrorCount;
    }

    /** Updates the browser-specific test counts (passed/failed/skipped). */
    private updateBrowserSummary(browser: string, status: string): void {
        const bSummary = this.getOrCreateBrowserSummary(browser);
        bSummary.total++;

        switch (status) {
            case 'passed':
                bSummary.totalPassed++;
                break;
            case 'failed':
                bSummary.totalFailed++;
                break;
            case 'skipped':
                bSummary.totalSkipped++;
                break;
        }
    }

    /** Updates the global execution summary counts. */
    private updateGlobalSummary(test: TestCase, result: TestResult): void {
        const isFlaky = test.results.length > 1 && result.status === 'passed';
        if (isFlaky) this.executionSummary.totalFlaky++;

        switch (result.status) {
            case 'passed':
                this.executionSummary.totalPassed++;
                break;
            case 'failed':
                this.executionSummary.totalFailed++;
                break;
            case 'skipped':
                this.executionSummary.totalSkipped++;
                break;
        }
        this.executionSummary.total++;
    }

    // ────────────────────────────────────────────────────────────────────────
    //  Helpers
    // ────────────────────────────────────────────────────────────────────────

    /** Ensures a file group key exists in the grouped results map. */
    private ensureGroupExists(fileGroup: string): void {
        if (!this.executionSummary.groupedResults[fileGroup]) {
            this.executionSummary.groupedResults[fileGroup] = [];
        }
    }

    /** Lazily initialises and returns the browser summary for the given browser name. */
    private getOrCreateBrowserSummary(browser: string): TestSummary {
        const summaries = this.executionSummary.browserSummaries!;
        if (!summaries[browser]) {
            summaries[browser] = {
                duration: '0s',
                status: '',
                statusIcon: '',
                total: 0,
                totalFailed: 0,
                totalFlaky: 0,
                totalPassed: 0,
                totalSkipped: 0,
                groupedResults: {},
                wcagErrors: {},
                totalA11yErrorCount: 0,
            };
        }
        return summaries[browser];
    }
}

export default SnapAllyReporter;
