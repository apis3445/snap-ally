import type { Page, TestInfo } from '@playwright/test';

/**
 * Handles visual feedback and Playwright annotations during an accessibility audit.
 *
 * Responsibilities:
 * - Rendering violation banners and element highlights via a Shadow DOM overlay
 * - Capturing screenshots and attaching them to the Playwright test report
 *
 * All DOM mutations are isolated inside a Shadow DOM root to avoid
 * interfering with the page under test.
 */
export class A11yAuditOverlay {
    private readonly overlayRootId = 'a11y-audit-overlay-root';

    /** IDs for elements created inside the shadow root. */
    private static readonly BANNER_ID = 'a11y-banner';
    private static readonly HIGHLIGHT_ID = 'a11y-highlight';

    constructor(private readonly page: Page) {}

    // ──────────────────────────────────────────────
    //  Violation banner
    // ──────────────────────────────────────────────

    /**
     * Shows a compact, modern banner at the bottom of the page describing the violation.
     *
     * @param violation - Object containing the Axe rule `id` and human-readable `help` text.
     * @param color     - CSS colour used as the banner background (rgb/rgba/hex).
     */
    async showViolationOverlay(
        violation: { id: string; help: string },
        color: string
    ): Promise<void> {
        await this.safeEvaluate(
            ([v, rawColor, rootId, bannerId]: [{ id: string; help: string }, string, string, string]) => {
                // --- helpers scoped to the browser context ---
                const toAlphaColor = (c: string, alpha = 0.85): string => {
                    if (c.includes('rgba')) return c;
                    if (c.includes('rgb'))
                        return c.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
                    // Hex – append alpha byte (0xD9 ≈ 0.85)
                    return `${c}D9`;
                };

                const getOrCreateRoot = (id: string): ShadowRoot => {
                    let root = document.getElementById(id);
                    if (!root) {
                        root = document.createElement('div');
                        root.id = id;
                        root.style.cssText =
                            'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;';
                        document.body.appendChild(root);
                        root.attachShadow({ mode: 'open' });
                    }
                    return root.shadowRoot!;
                };

                // --- main logic ---
                const shadow = getOrCreateRoot(rootId);
                let container = shadow.getElementById(bannerId);

                if (!container) {
                    const style = document.createElement('style');
                    style.textContent = `
                        #${bannerId} {
                            position: fixed;
                            left: 50%;
                            bottom: 24px;
                            transform: translateX(-50%);
                            width: calc(100% - 40px);
                            max-width: 600px;
                            padding: 12px 18px;
                            border-radius: 12px;
                            color: white;
                            font-family: system-ui, -apple-system, sans-serif;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            box-shadow: 0 12px 40px rgba(0,0,0,0.3);
                            backdrop-filter: blur(16px) saturate(180%);
                            -webkit-backdrop-filter: blur(16px) saturate(180%);
                            border: 1px solid rgba(255,255,255,0.15);
                            z-index: 10000;
                        }
                        .badge {
                            background: rgba(255,255,255,0.2);
                            padding: 2px 8px;
                            border-radius: 6px;
                            font-size: 11px;
                            font-weight: 700;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            border: 1px solid rgba(255,255,255,0.2);
                        }
                        .content {
                            flex: 1;
                            line-height: 1.4;
                            font-weight: 500;
                            overflow: hidden;
                        }
                    `;
                    shadow.appendChild(style);

                    container = document.createElement('div');
                    container.id = bannerId;
                    shadow.appendChild(container);
                }

                container.style.backgroundColor = toAlphaColor(rawColor);

                // Build DOM nodes instead of innerHTML to prevent XSS
                container.textContent = ''; // clear previous content

                const icon = document.createElement('div');
                icon.style.fontSize = '20px';
                icon.textContent = '⚠️';

                const badge = document.createElement('span');
                badge.className = 'badge';
                badge.textContent = v.id;

                const helpText = document.createElement('span');
                helpText.style.opacity = '0.9';
                helpText.textContent = v.help;

                const row = document.createElement('div');
                row.style.cssText = 'margin-bottom:4px;display:flex;align-items:center;gap:8px;';
                row.appendChild(badge);
                row.appendChild(helpText);

                const content = document.createElement('div');
                content.className = 'content';
                content.appendChild(row);

                container.appendChild(icon);
                container.appendChild(content);
            },
            [
                violation,
                color,
                this.overlayRootId,
                A11yAuditOverlay.BANNER_ID,
            ] as const
        );
    }

    /**
     * Removes the violation description banner from the page.
     */
    async hideViolationOverlay(): Promise<void> {
        await this.safeEvaluate((rootId: string) => {
            const el = document.getElementById(rootId);
            if (el) el.remove();
        }, this.overlayRootId);
    }

    // ──────────────────────────────────────────────
    //  Element highlighting
    // ──────────────────────────────────────────────

    /**
     * Draws a glowing highlight border around the element matching `selector`.
     *
     * The element is scrolled into view first so that the highlight coordinates
     * are accurate after any layout shift.
     *
     * @param selector - A CSS selector that uniquely identifies the target element.
     * @param color    - CSS colour for the highlight border and glow.
     */
    async highlightElement(selector: string, color: string): Promise<void> {
        await this.safeEvaluate(
            ([sel, rawColor, rootId, highlightId]: [string, string, string, string]) => {
                const target = document.querySelector(sel) as HTMLElement | null;
                if (!target) return;

                target.scrollIntoView({ behavior: 'auto', block: 'center' });

                const toAlphaColor = (c: string, alpha: number): string => {
                    if (c.includes('rgba'))
                        return c.replace(/[\d.]+\)$/, `${alpha})`);
                    if (c.includes('rgb'))
                        return c.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
                    // Hex – convert alpha to 2-char hex
                    const hex = Math.round(alpha * 255)
                        .toString(16)
                        .padStart(2, '0');
                    return `${c}${hex}`;
                };

                const getOrCreateRoot = (id: string): ShadowRoot => {
                    let root = document.getElementById(id);
                    if (!root) {
                        root = document.createElement('div');
                        root.id = id;
                        root.style.cssText =
                            'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;';
                        document.body.appendChild(root);
                        root.attachShadow({ mode: 'open' });
                    }
                    return root.shadowRoot!;
                };

                const shadow = getOrCreateRoot(rootId);
                let highlight = shadow.getElementById(highlightId);

                if (!highlight) {
                    const style = document.createElement('style');
                    style.textContent = `
                        #${highlightId} {
                            position: absolute;
                            pointer-events: none;
                            border-radius: 8px;
                            box-sizing: border-box;
                            z-index: 9999;
                            box-shadow: 0 0 0 4px var(--c-alpha), 0 0 20px var(--c-alpha);
                        }
                        .glow {
                            position: absolute;
                            inset: 0;
                            border-radius: inherit;
                            border: 2px solid var(--c);
                        }
                    `;
                    shadow.appendChild(style);

                    highlight = document.createElement('div');
                    highlight.id = highlightId;
                    const glow = document.createElement('div');
                    glow.className = 'glow';
                    highlight.appendChild(glow);
                    shadow.appendChild(highlight);
                }

                const pad = 4;
                const rect = target.getBoundingClientRect();
                highlight.style.left = `${rect.left + window.scrollX - pad}px`;
                highlight.style.top = `${rect.top + window.scrollY - pad}px`;
                highlight.style.width = `${rect.width + pad * 2}px`;
                highlight.style.height = `${rect.height + pad * 2}px`;
                highlight.style.border = `3px solid ${rawColor}`;
                highlight.style.setProperty('--c', rawColor);
                highlight.style.setProperty('--c-alpha', toAlphaColor(rawColor, 0.3));
            },
            [
                selector,
                color,
                this.overlayRootId,
                A11yAuditOverlay.HIGHLIGHT_ID,
            ] as const
        );
    }

    /**
     * Removes the element highlight from the page.
     */
    async unhighlightElement(): Promise<void> {
        await this.safeEvaluate(
            ([rootId, highlightId]: [string, string]) => {
                const root = document.getElementById(rootId);
                if (root?.shadowRoot) {
                    const highlight = root.shadowRoot.getElementById(highlightId);
                    if (highlight) highlight.remove();
                }
            },
            [this.overlayRootId, A11yAuditOverlay.HIGHLIGHT_ID] as const
        );
    }

    // ──────────────────────────────────────────────
    //  Test report helpers
    // ──────────────────────────────────────────────

    /**
     * Attaches arbitrary data to the Playwright test report.
     *
     * @param testInfo    - The current Playwright `TestInfo` instance.
     * @param name        - Attachment name shown in the report.
     * @param description - Content to attach (serialised as JSON by the caller).
     */
    async addTestAttachment(
        testInfo: TestInfo,
        name: string,
        description: string
    ): Promise<void> {
        await testInfo.attach(name, {
            contentType: 'application/json',
            body: Buffer.from(description),
        });
    }

    /**
     * Captures a viewport screenshot and attaches it to the test report.
     *
     * The screenshot uses `fullPage: false` (viewport only) to avoid browser
     * resizing flashes that can occur with full-page captures.
     *
     * @param fileName - Name for the attachment in the test report.
     * @param testInfo - The current Playwright `TestInfo` instance.
     * @returns The raw screenshot buffer.
     */
    async captureAndAttachScreenshot(fileName: string, testInfo: TestInfo): Promise<Buffer> {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { test } = require('@playwright/test');
        return await test.step('Capture A11y screenshot', async () => {
            const screenshot = await this.page.screenshot({ fullPage: false });
            await testInfo.attach(fileName, { contentType: 'image/png', body: screenshot });
            return screenshot;
        });
    }

    // ──────────────────────────────────────────────
    //  Private helpers
    // ──────────────────────────────────────────────

    /**
     * Wrapper around `page.evaluate` that silently swallows errors caused by
     * the page or browser closing mid-evaluation (e.g. navigation, test teardown).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async safeEvaluate(fn: any, arg?: any): Promise<void> {
        try {
            if (arg !== undefined) {
                await this.page.evaluate(fn, arg);
            } else {
                await this.page.evaluate(fn);
            }
        } catch (error: unknown) {
            if (
                error instanceof Error &&
                (error.message.includes('Target page, context or browser has been closed') ||
                    error.message.includes('Execution context was destroyed') ||
                    error.message.includes('Test ended'))
            ) {
                // Page navigated away or test ended — overlay is no longer relevant.
                return;
            }
            throw error;
        }
    }
}
