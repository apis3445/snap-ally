import * as fs from 'fs';
import * as path from 'path';
import type { FullConfig, Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import { HtmlRenderer } from './core/HtmlRenderer';
import { ReportAssets } from './core/ReportAssets';
import { A11Y_SCAN_ATTEMPTED_ANNOTATION } from './core/Scanner';
import { TimeUtils } from './utils/TimeUtils';
import {
    TestSummary,
    TestStatusIcon,
    TestResults,
    ResolvedColors,
    DEFAULT_COLORS,
    ReporterOptions,
    ReportData,
    Violation,
    Target,
} from './models';

/**
 * Playwright reporter for accessibility audits and test steps.
 */
class SnapAllyReporter implements Reporter {
    private readonly outputFolder: string;
    private readonly assetsManager = new ReportAssets();
    private readonly renderer = new HtmlRenderer();
    private readonly options: ReporterOptions;
    private readonly colors: ResolvedColors;

    private projectRoot = 'tests';
    private testIndex = 0;
    private readonly tasks: Promise<void>[] = [];

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
        colors: {},
    };
    private readonly testRuleCounts: Record<string, Record<string, number>> = {};
    private readonly testGlobalCounts: Record<string, number> = {};

    constructor(options: ReporterOptions = {}) {
        this.options = { verbose: true, consoleLog: true, ...options };
        this.outputFolder = path.resolve(process.cwd(), options.outputFolder || 'steps-report');
        this.validateOutputFolder(this.outputFolder);
        this.colors = {
            critical: options.colors?.critical || DEFAULT_COLORS.critical,
            serious: options.colors?.serious || DEFAULT_COLORS.serious,
            moderate: options.colors?.moderate || DEFAULT_COLORS.moderate,
            minor: options.colors?.minor || DEFAULT_COLORS.minor,
        };
        this.executionSummary.colors = this.colors;
    }

    printsToStdio(): boolean {
        return true;
    }

    /**
     * Validates that the output folder is safe to delete.
     * Prevents accidental deletion of critical directories like repo root, parent dirs, or system paths.
     */
    private validateOutputFolder(resolvedPath: string): void {
        const cwd = process.cwd();
        const normalizedPath = path.normalize(resolvedPath);
        const normalizedCwd = path.normalize(cwd);

        // Prevent deletion of current working directory
        if (normalizedPath === normalizedCwd) {
            throw new Error(
                '[SnapAlly] Invalid outputFolder: Cannot delete the current working directory. ' +
                `Resolved path: "${resolvedPath}"`
            );
        }

        // Prevent deletion of parent directories
        if (normalizedCwd.startsWith(normalizedPath + path.sep) || normalizedCwd.startsWith(normalizedPath + '/')) {
            throw new Error(
                '[SnapAlly] Invalid outputFolder: Cannot delete a parent directory of the current working directory. ' +
                `Resolved path: "${resolvedPath}"`
            );
        }

        // Prevent deletion of root or near-root directories
        const pathSegments = normalizedPath.split(path.sep).filter(s => s.length > 0);
        if (pathSegments.length <= 1) {
            throw new Error(
                '[SnapAlly] Invalid outputFolder: Path is too close to root directory. ' +
                `Resolved path: "${resolvedPath}"`
            );
        }

        // Ensure the path is within the current working directory (safest approach)
        if (!normalizedPath.startsWith(normalizedCwd + path.sep) && !normalizedPath.startsWith(normalizedCwd + '/')) {
            throw new Error(
                '[SnapAlly] Invalid outputFolder: Path must be within the current working directory. ' +
                `Resolved path: "${resolvedPath}", CWD: "${cwd}"`
            );
        }
    }

    onBegin(config: FullConfig) {
        this.projectRoot = config.rootDir;
        if (fs.existsSync(this.outputFolder)) {
            fs.rmSync(this.outputFolder, { recursive: true, force: true });
        }
    }

    onTestEnd(test: TestCase, result: TestResult) {
        const index = ++this.testIndex;
        this.tasks.push(this.processTestResult(test, result, index));
    }

    async onEnd(result: FullResult) {
        await Promise.all(this.tasks);

        const summaryPath = path.join(this.outputFolder, 'summary.html');
        this.executionSummary.status = result.status;
        this.executionSummary.statusIcon =
            result.status === 'passed' ? TestStatusIcon.passed : TestStatusIcon.failed;
        this.executionSummary.date = TimeUtils.formatDate(new Date());
        this.executionSummary.duration = TimeUtils.formatDuration(result.duration);

        await this.renderer.render(
            'execution-summary.html',
            this.executionSummary as unknown as Record<string, unknown>,
            this.outputFolder,
            summaryPath
        );

        console.log(`\n[SnapAlly] Report generated: ${summaryPath}`);
    }

    private async processTestResult(test: TestCase, result: TestResult, index: number) {
        const testFolderName = `test-${index}`;
        const testFolder = path.join(this.outputFolder, testFolderName);

        const videoPath = this.assetsManager.copyVideos(result, testFolder);
        const screenshotPaths = this.assetsManager.copyScreenshots(result, testFolder);
        const attachments = this.assetsManager.copyAllOtherAttachments(result, testFolder);

        // A single test may call scanA11y/checkAccessibility multiple times (e.g.
        // before and after login), producing one 'A11y' attachment per scan. Read
        // every 'A11y' attachment and merge their violations so findings from all
        // scans are reported — not just the first.
        const a11yAttachments = result.attachments.filter((a) => a.name === 'A11y' && a.body);
        // Only tests that actually called scanA11y/checkAccessibility carry this annotation —
        // warning for every other test would be false-positive noise (see GH issue: warning
        // fired for tests that never scan for accessibility at all).
        const scanAttempted = test.annotations.some((a) => a.type === A11Y_SCAN_ATTEMPTED_ANNOTATION);
        if (scanAttempted && a11yAttachments.length === 0 && this.options.verbose) {
            console.warn(`[SnapAlly] A11y attachment missing for test: ${test.title}. Available: ${result.attachments.map(a => a.name).join(', ')}`);
        }

        const parsedData: ReportData[] = [];
        for (const att of a11yAttachments) {
            try {
                const raw = JSON.parse(att.body!.toString());
                // Handle cases where the payload is the direct ReportData or wrapped in a data property
                const data = (raw && typeof raw === 'object' && 'data' in raw ? (raw as { data: ReportData }).data : raw) as ReportData | null;
                if (data) parsedData.push(data);
            } catch (err) {
                // Only decode a short prefix — the body can be large (each target carries screenshotBase64).
                const prefix = att.body!.subarray(0, 100).toString('utf8');
                console.error(`[SnapAlly] Failed to parse A11y attachment (${att.body!.length} bytes): ${err}. Body starts with: ${prefix}`);
            }
        }

        // ADO settings are configured globally (options/env), so any scan carries
        // the same values; use the first for that metadata.
        const actualData = parsedData[0] || null;

        // Aggregate violations across every scan, preserving the page each was found
        // on (falling back to the owning scan's URL for payloads from older versions).
        const violations = parsedData.flatMap((d) => {
            const scanUrl = d.pageUrl || d.pageKey;
            const errs = d.a11yErrors || (d as unknown as { violations: Violation[] }).violations || [];
            return errs.map((v) => ({ ...v, pageUrl: v.pageUrl || scanUrl, pageKey: v.pageKey || d.pageKey }));
        });
        const a11yErrorCount = violations.reduce((acc: number, curr: Violation) => acc + (curr.total || curr.target?.length || (curr as unknown as { nodes: unknown[] }).nodes?.length || 0), 0);

        // A single test may scan several pages (e.g. before/after login). Surface
        // every distinct page instead of attributing all violations to the first.
        const uniquePageUrls = [...new Set(parsedData.map((d) => d.pageUrl || d.pageKey).filter((u): u is string => !!u))];
        const resolvedPageUrl = uniquePageUrls.length === 0
            ? 'Resource'
            : uniquePageUrls.length === 1
                ? uniquePageUrls[0]
                : 'Multiple pages';

        const filteredSteps = (() => {
            const blocklist = ['Evaluate', 'Create page', 'Close page', 'Before Hooks', 'After Hooks', 'Worker Teardown', 'Worker Cleanup', 'Attach', 'Wait for timeout', 'Capture A11y screenshot', 'Scroll into view', 'Bounding box', 'Highlight element'];
            const filtered = result.steps
                .filter((s) => !blocklist.some(b => s.title.includes(b)))
                .map((s) => s.title);
            return filtered;
        })();

        const testResults: TestResults = {
            num: index,
            folderName: testFolderName,
            title: test.title,
            fileName: path.relative(this.projectRoot, test.location.file),
            duration: TimeUtils.formatDuration(result.duration),
            timeDuration: result.duration,
            description: '', // Could extract from annotations if needed
            status: result.status,
            statusIcon: this.getStatusIcon(result.status),
            browser: (test as unknown as { _projectId?: string })._projectId ||
                test.parent?.project()?.name ||
                (test as unknown as { projectName?: string }).projectName ||
                'chromium',
            adoOrganization: this.options.ado?.organization || actualData?.adoOrganization,
            adoProject: this.options.ado?.project || actualData?.adoProject,
            adoAreaPath: this.options.ado?.areaPath || actualData?.adoAreaPath,
            timestamp: new Date().toLocaleString(),
            pageUrl: resolvedPageUrl,
            pageUrls: uniquePageUrls,
            tags: [], // Extract from test tags if available
            preConditions: [],
            steps: filteredSteps,
            postConditions: [],
            videoPath: videoPath.length > 0 ? videoPath : null,
            screenshotPaths,
            attachments,
            errors: result.errors.map((e) => this.renderer.ansiToHtml(e.message || '')),
            a11yErrors: violations.map((v: Violation) => ({
                ...v,
                target: (v.target || []).map((t: Target) => ({
                    ...t,
                    steps: (t.steps && t.steps.length > 0) ? t.steps : filteredSteps
                }))
            })),
            a11yErrorCount: a11yErrorCount,
            colors: this.colors,
        };

        const reportFileName = 'report.html';
        const a11yReportFileName = 'accessibility-report.html';

        testResults.executionReportPath = `${testFolderName}/${reportFileName}`;

        // Generate separate accessibility report if there are a11y errors
        if (violations.length > 0) {
            testResults.a11yReportPath = `${testFolderName}/${a11yReportFileName}`;
            const a11yReportPath = path.join(testFolder, a11yReportFileName);

            console.log(`[SnapAlly] Generating A11y report for ${test.title} (Browser: ${testResults.browser})`);

            await this.renderer.render(
                'accessibility-report.html',
                testResults as unknown as Record<string, unknown>,
                testFolder,
                a11yReportPath
            );
        }

        // Removed debug logging of internal data state

        const reportPath = path.join(testFolder, reportFileName);
        await this.renderer.render(
            'test-execution-report.html',
            testResults as unknown as Record<string, unknown>,
            testFolder,
            reportPath
        );

        this.updateSummary(test, testResults);
    }

    private getStatusIcon(status: string): string {
        switch (status) {
            case 'passed':
                return TestStatusIcon.passed;
            case 'failed':
            case 'timedOut':
                return TestStatusIcon.failed;
            case 'skipped':
                return TestStatusIcon.skipped;
            default:
                return 'help';
        }
    }

    private updateSummary(test: TestCase, result: TestResults) {
        const browser = result.browser;
        if (!this.executionSummary.groupedResults[browser]) {
            this.executionSummary.groupedResults[browser] = [];
        }
        this.executionSummary.groupedResults[browser].push(result);

        // Initialize browser summary if needed
        if (!this.executionSummary.browserSummaries) {
            this.executionSummary.browserSummaries = {};
        }

        if (!this.executionSummary.browserSummaries[browser]) {
            this.executionSummary.browserSummaries[browser] = {
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
            };
        }
        const bSummary = this.executionSummary.browserSummaries[browser];

        this.executionSummary.total++;
        bSummary.total++;

        if (result.status === 'passed') {
            this.executionSummary.totalPassed++;
            bSummary.totalPassed++;
        } else if (result.status === 'failed' || result.status === 'timedOut') {
            this.executionSummary.totalFailed++;
            bSummary.totalFailed++;
        } else if (result.status === 'skipped') {
            this.executionSummary.totalSkipped++;
            bSummary.totalSkipped++;
        }

        // Build a browser-independent key so the same test running on different
        // browser projects de-duplicates to a single entry in the global summary.
        // titlePath() starts at the root suite (empty title) followed by the
        // project (browser) name; drop both so only file/describe/test remain.
        const projectName = test.parent?.project()?.name;
        const keySegments = test.titlePath().filter((s) => s.length > 0);
        if (projectName && keySegments[0] === projectName) keySegments.shift();
        const testKey = keySegments.join(' > ');
        const violations = result.a11yErrors || (result as unknown as { violations: Violation[] }).violations;
        if (violations && violations.length > 0) {
            const count = result.a11yErrorCount || violations.reduce((acc: number, curr: Violation) => acc + (curr.total || curr.target?.length || (curr as unknown as { nodes: unknown[] }).nodes?.length || 0), 0);

            // De-duplicate global count across browsers for same test case
            const prevTestGlobalCount = this.testGlobalCounts[testKey] || 0;
            if (count > prevTestGlobalCount) {
                this.executionSummary.totalA11yErrorCount += (count - prevTestGlobalCount);
                this.testGlobalCounts[testKey] = count;
            }

            bSummary.totalA11yErrorCount += count;

            // A single test can produce multiple violation entries for the same
            // rule (e.g. one per scan when scanA11y runs more than once). Sum the
            // occurrences per rule first, then apply the cross-browser de-dup so
            // repeated rule IDs within a test are counted as additional occurrences
            // rather than dropped as duplicates.
            const ruleSums = new Map<string, number>();
            const ruleMeta = new Map<string, { severity: string; helpUrl?: string; description?: string }>();
            for (const err of violations) {
                const ruleId = err.id;
                const occCount = (err.total || err.target?.length || (err as unknown as { nodes?: unknown[] }).nodes?.length || 0);
                ruleSums.set(ruleId, (ruleSums.get(ruleId) || 0) + occCount);
                if (!ruleMeta.has(ruleId)) {
                    ruleMeta.set(ruleId, {
                        severity: err.severity || (err as unknown as { impact?: string }).impact || 'minor',
                        helpUrl: err.helpUrl,
                        description: err.description,
                    });
                }
            }

            if (!this.testRuleCounts[testKey]) this.testRuleCounts[testKey] = {};

            for (const [ruleId, summedOccCount] of ruleSums) {
                const meta = ruleMeta.get(ruleId)!;

                // Update global wcagErrors (de-duplicated: max across browsers)
                if (!this.executionSummary.wcagErrors[ruleId]) {
                    this.executionSummary.wcagErrors[ruleId] = {
                        count: 0,
                        severity: meta.severity,
                        helpUrl: meta.helpUrl,
                        description: meta.description,
                    };
                }

                const prevRuleOccCount = this.testRuleCounts[testKey][ruleId] || 0;
                if (summedOccCount > prevRuleOccCount) {
                    this.executionSummary.wcagErrors[ruleId].count += (summedOccCount - prevRuleOccCount);
                    this.testRuleCounts[testKey][ruleId] = summedOccCount;
                }

                // Update browser-specific wcagErrors (per browser sum)
                if (!bSummary.wcagErrors[ruleId]) {
                    bSummary.wcagErrors[ruleId] = {
                        count: 0,
                        severity: meta.severity,
                        helpUrl: meta.helpUrl,
                        description: meta.description,
                    };
                }
                bSummary.wcagErrors[ruleId].count += summedOccCount;
            }
        }
    }
}

export default SnapAllyReporter;
