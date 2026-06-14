import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { VisualReporter } from './VisualReporter';
import { Violation, ReportData, Target, ScannerOptions, ReporterOptions, DEFAULT_COLORS, getSeverityColor } from '../models';
import { TimeUtils } from '../utils/TimeUtils';

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;
type AxeViolation = AxeResults['violations'][number];

/** Annotation types rendered separately in the report, so they must not repeat as context steps. */
const EXCLUDED_ANNOTATION_TYPES = new Set(['Pre Condition', 'Post Condition', 'Description', 'A11y']);

/**
 * Matches reporter ids that refer to SnapAllyReporter: the file path used
 * inside this repo (e.g. './src/SnapAllyReporter.ts') or the published
 * package name ('snap-ally').
 */
const REPORTER_ID_PATTERN = /snap-?ally/i;

/**
 * Sanitizes a string to be safe for use in file paths and prevents path traversal attacks.
 */
function sanitizePageKey(input: string): string {
    return (
        input
            .replace(/^https?:\/\//, '')
            .replace(/[\/\\:*?"<>|]/g, '-')
            .replace(/\.\./g, '')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase()
            .substring(0, 200)
    );
}

/**
 * Reads the SnapAllyReporter options from the Playwright config so scans can
 * fall back to the globally configured defaults.
 */
function getReporterOptions(testInfo: TestInfo): ReporterOptions {
    // A reporter entry is normally a [name, options?] tuple, but Playwright also
    // accepts a bare string (e.g. reporter: 'snap-ally'), so handle both shapes.
    const reporters = testInfo.config.reporter as ReadonlyArray<string | readonly [string, unknown?]>;
    const entry = reporters.find((descriptor) => {
        const name = typeof descriptor === 'string' ? descriptor : descriptor[0];
        return REPORTER_ID_PATTERN.test(name);
    });
    if (!entry || typeof entry === 'string') {
        return {};
    }
    return (entry[1] ?? {}) as ReporterOptions;
}

function buildAxe(page: Page, options: ScannerOptions): AxeBuilder {
    let builder = new AxeBuilder({ page });

    const target: unknown = options.include || options.box;
    if (target) {
        // AxeBuilder.include only accepts selector strings (axe-core SerialFrameSelector),
        // never a Playwright Locator. Guard JS callers that bypass the type with a clear error.
        if (typeof target !== 'string') {
            throw new Error(
                '[SnapAlly] "include"/"box" must be a CSS selector string; ' +
                'Playwright Locators are not supported by AxeBuilder.'
            );
        }
        builder = builder.include(target);
    }
    if (options.rules) {
        builder = builder.options({ rules: options.rules });
    }
    if (options.tags) {
        builder = builder.withTags(options.tags);
    }
    if (options.axeOptions) {
        builder = builder.options(options.axeOptions);
    }
    return builder;
}

/**
 * Runs the Axe analysis, returning null when the page closed before the scan
 * could finish (e.g. the test already ended).
 */
async function runAxe(builder: AxeBuilder): Promise<AxeResults | null> {
    try {
        return await builder.analyze();
    } catch (error: unknown) {
        if (
            error instanceof Error &&
            (error.message.includes('Test ended') ||
                error.message.includes('Target page, context or browser has been closed'))
        ) {
            console.warn(`[SnapAlly] Accessibility scan skipped: ${error.message}`);
            return null;
        }
        throw error;
    }
}

async function logViolations(
    page: Page,
    violations: AxeViolation[],
    showTerminal: boolean,
    showBrowser: boolean
): Promise<void> {
    if (violations.length === 0 || (!showTerminal && !showBrowser)) {
        return;
    }

    const mainMsg = `[A11yScanner] Violations found: ${violations.length}`;
    const detailMessages = violations.map((violation, index) => `  ${index + 1}. ${violation.id} [${violation.impact}] - ${violation.help}`);

    if (showTerminal) {
        console.log(`\n${mainMsg}`);
        detailMessages.forEach((msg) => console.log(msg));
    }

    if (showBrowser) {
        await page.evaluate(
            ([msg, details, color]) => {
                console.log(`%c ${msg}`, `color: ${color}; font-weight: bold; font-size: 12px;`);
                (details as string[]).forEach((line: string) => console.log(line));
            },
            [mainMsg, detailMessages, DEFAULT_COLORS.serious] as [string, string[], string]
        );
    }
}

/**
 * Highlights each visible violating element, captures a screenshot per element,
 * and returns the violation enriched with that visual evidence.
 */
async function collectViolationEvidence(
    page: Page,
    testInfo: TestInfo,
    visualReporter: VisualReporter,
    violation: AxeViolation,
    severityColor: string,
    contextSteps: string[]
): Promise<Violation> {
    const targets: Target[] = [];
    let screenshotIndex = 0;

    await visualReporter.showBanner({ id: violation.id, help: violation.help, color: severityColor });

    for (const node of violation.nodes) {
        for (const selector of node.target) {
            const elementSelector = selector.toString();

            if (!(await page.locator(elementSelector).isVisible())) {
                continue;
            }

            await visualReporter.highlightElement(elementSelector, severityColor);
            // Let the highlight transition settle before the screenshot.
            // eslint-disable-next-line playwright/no-wait-for-timeout
            await page.waitForTimeout(100);

            const screenshotName = `a11y-${violation.id}-${screenshotIndex++}.png`;
            const buffer = await visualReporter.captureScreenshot(testInfo, screenshotName);

            targets.push({
                element: elementSelector,
                snippet: elementSelector,
                html: node.html || '',
                screenshot: screenshotName,
                steps: contextSteps,
                stepsJson: JSON.stringify(contextSteps),
                screenshotBase64: buffer.toString('base64'),
            });

            await visualReporter.removeHighlight();
        }
    }

    // Remove this violation's banner so banners don't stack across violations.
    await visualReporter.cleanupOverlay();

    return {
        id: violation.id,
        description: violation.description,
        severity: violation.impact || 'unknown',
        helpUrl: violation.helpUrl,
        help: violation.help,
        guideline: violation.tags[1] || 'N/A',
        wcagRule: violation.tags.find((tag) => tag.startsWith('wcag')) || violation.tags[1] || 'N/A',
        total: targets.length || violation.nodes.length,
        target: targets,
    };
}

/**
 * Performs an accessibility audit using Axe and attaches the results as the
 * 'A11y' attachment consumed by SnapAllyReporter.
 */
export async function scanA11y(page: Page, testInfo: TestInfo, options: ScannerOptions = {}) {
    const globalOptions = getReporterOptions(testInfo);

    // Resolve final options (local > global > default)
    const showTerminal = options.verbose ?? globalOptions.verbose ?? true;
    const showBrowser = options.consoleLog ?? globalOptions.consoleLog ?? true;
    const pageKey = sanitizePageKey(options.pageKey || page.url());
    const customColors = globalOptions.colors;

    const axeResults = await runAxe(buildAxe(page, options));
    if (!axeResults) {
        return;
    }

    await logViolations(page, axeResults.violations, showTerminal, showBrowser);

    const violationCount = axeResults.violations.length;

    await test.step('Check Accessibility', async () => {
        expect.soft(violationCount).toBe(0);
    });

    const visualReporter = new VisualReporter(page);
    const contextSteps = (testInfo.annotations || [])
        .filter((annotation) => !EXCLUDED_ANNOTATION_TYPES.has(annotation.type))
        .map((annotation) => annotation.description || '');

    const scannedUrl = page.url();
    const violations: Violation[] = [];
    for (const violation of axeResults.violations) {
        const severityColor = getSeverityColor(violation.impact, customColors);
        const evidence = await collectViolationEvidence(page, testInfo, visualReporter, violation, severityColor, contextSteps);
        // Stamp the violation with the page it was found on so reports and ADO
        // bugs stay accurate when a single test scans several pages.
        violations.push({ ...evidence, pageUrl: scannedUrl, pageKey });
    }

    const reportData: ReportData = {
        pageKey,
        pageUrl: scannedUrl,
        accessibilityScore: 0,
        a11yErrors: violations,
        criticalColor: customColors?.critical || DEFAULT_COLORS.critical,
        seriousColor: customColors?.serious || DEFAULT_COLORS.serious,
        moderateColor: customColors?.moderate || DEFAULT_COLORS.moderate,
        minorColor: customColors?.minor || DEFAULT_COLORS.minor,
        adoOrganization: options.ado?.organization || globalOptions.ado?.organization || process.env.ADO_ORGANIZATION || '',
        adoProject: options.ado?.project || globalOptions.ado?.project || process.env.ADO_PROJECT || '',
        adoAreaPath: options.ado?.areaPath || globalOptions.ado?.areaPath || process.env.ADO_AREA_PATH || '',
        timestamp: TimeUtils.formatDate(new Date()),
    };

    await visualReporter.attachJsonData(testInfo, 'A11y', JSON.stringify(reportData));
    await visualReporter.cleanupOverlay();
}

export const checkAccessibility = scanA11y;
