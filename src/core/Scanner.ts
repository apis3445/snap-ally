import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { VisualReporter } from './VisualReporter';
import { Violation, ReportData, Target, ScannerOptions, ReporterOptions, DEFAULT_COLORS, getSeverityColor } from '../models';
import { TimeUtils } from '../utils/TimeUtils';

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
 * Performs an accessibility audit using Axe and Lighthouse.
 */
export async function scanA11y(page: Page, testInfo: TestInfo, options: ScannerOptions = {}) {
    // 1. Find reporter config for global defaults
    const reporterConfig = testInfo.config.reporter.find((r) =>
        Array.isArray(r) &&
        (typeof r[0] === 'string' &&
            (r[0].includes('SnapAllyReporter') || r[0].endsWith('SnapAllyReporter.ts')))
    );
    const globalOptions: ReporterOptions = (Array.isArray(reporterConfig) ? (reporterConfig[1] ?? {}) : {}) as ReporterOptions;

    // 2. Resolve final options (local > global > default)
    const showTerminal = options.verbose ?? globalOptions.verbose ?? true;
    const showBrowser = options.consoleLog ?? globalOptions.consoleLog ?? true;
    const rawPageKey = options.pageKey || page.url();
    const pageKey = sanitizePageKey(rawPageKey);
    const overlay = new VisualReporter(page);

    let axeBuilder = new AxeBuilder({ page });

    const target = options.include || options.box;
    if (target) {
        if (typeof target === 'string') {
            axeBuilder = axeBuilder.include(target);
        } else {
            axeBuilder = axeBuilder.include(target as unknown as string);
        }
    }

    if (options.rules) {
        axeBuilder = axeBuilder.options({ rules: options.rules });
    }

    if (options.tags) {
        axeBuilder = axeBuilder.withTags(options.tags);
    }

    if (options.axeOptions) {
        axeBuilder = axeBuilder.options(options.axeOptions);
    }

    let axeResults;
    try {
        axeResults = await axeBuilder.analyze();
    } catch (error: unknown) {
        if (
            error instanceof Error &&
            (error.message.includes('Test ended') ||
                error.message.includes('Target page, context or browser has been closed'))
        ) {
            console.warn(`[SnapAlly] Accessibility scan skipped: ${error.message}`);
            return;
        }
        throw error;
    }

    const violationCount = axeResults.violations.length;

    if ((showTerminal || showBrowser) && violationCount > 0) {
        const mainMsg = `[A11yScanner] Violations found: ${violationCount}`;
        const detailMessages = axeResults.violations.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (v: any, i: number) => `  ${i + 1}. ${v.id} [${v.impact}] - ${v.help}`
        );

        if (showTerminal) {
            console.log(`\n${mainMsg}`);
            detailMessages.forEach((msg) => console.log(msg));
        }

        if (showBrowser) {
            await page.evaluate(
                ([mainMsg, details, color]) => {
                    console.log(
                        `%c ${mainMsg}`,
                        `color: ${color}; font-weight: bold; font-size: 12px;`
                    );
                    (details as string[]).forEach((msg: string) => console.log(msg));
                },
                [mainMsg, detailMessages, DEFAULT_COLORS.serious] as [string, string[], string]
            );
        }
    }

    await test.step('Check Accessibility', async () => {
        expect.soft(violationCount).toBe(0);
    });

    const customColors = globalOptions?.colors;

    const errors: Violation[] = [];

    for (const violation of axeResults.violations) {
        let errorIdx = 0;
        const targets: Target[] = [];
        const severityColor = getSeverityColor(violation.impact, customColors);

        for (const node of violation.nodes) {
            for (const selector of node.target) {
                const elementSelector = selector.toString();
                const locator = page.locator(elementSelector);

                await overlay.showBanner(
                    { id: violation.id, help: violation.help },
                    severityColor
                );

                if (await locator.isVisible()) {
                    await overlay.highlightElement(elementSelector, severityColor);
                    // eslint-disable-next-line playwright/no-wait-for-timeout
                    await page.waitForTimeout(100);

                    const screenshotName = `a11y-${violation.id}-${errorIdx++}.png`;
                    const buffer = await overlay.captureScreenshot(
                        testInfo,
                        screenshotName
                    );

                    const excluded = new Set([
                        'Pre Condition',
                        'Post Condition',
                        'Description',
                        'A11y',
                    ]);
                    const contextSteps = (testInfo.annotations || [])
                        .filter((a) => !excluded.has(a.type))
                        .map((a) => a.description || '');

                    const nodeHtml = node.html || '';
                    const friendlySnippet = elementSelector;

                    targets.push({
                        element: elementSelector,
                        snippet: friendlySnippet,
                        html: nodeHtml,
                        screenshot: screenshotName,
                        steps: contextSteps,
                        stepsJson: JSON.stringify(contextSteps),
                        screenshotBase64: buffer.toString('base64'),
                    });

                    await overlay.removeHighlight();
                }
            }
        }

        errors.push({
            id: violation.id,
            description: violation.description,
            severity: violation.impact || 'unknown',
            helpUrl: violation.helpUrl,
            help: violation.help,
            guideline: violation.tags[1] || 'N/A',
            wcagRule:
                violation.tags.find((t: string) => t.startsWith('wcag')) || violation.tags[1] || 'N/A',
            total: targets.length || violation.nodes.length,
            target: targets,
        });
    }

    const reportData: ReportData = {
        pageKey,
        pageUrl: page.url(),
        accessibilityScore: 0,
        a11yErrors: errors,
        criticalColor: customColors?.critical || DEFAULT_COLORS.critical,
        seriousColor: customColors?.serious || DEFAULT_COLORS.serious,
        moderateColor: customColors?.moderate || DEFAULT_COLORS.moderate,
        minorColor: customColors?.minor || DEFAULT_COLORS.minor,
        adoOrganization: options.ado?.organization || process.env.ADO_ORGANIZATION || '',
        adoProject: options.ado?.project || process.env.ADO_PROJECT || '',
        adoAreaPath: options.ado?.areaPath || process.env.ADO_AREA_PATH || '',
        timestamp: TimeUtils.formatDate(new Date()),
    };

    await overlay.attachJsonData(testInfo, 'A11y', JSON.stringify(reportData));
    await overlay.cleanupOverlay();
}

export const checkAccessibility = scanA11y;
