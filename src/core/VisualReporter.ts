import { type Page, type TestInfo, test } from '@playwright/test';

/**
 * Information about an accessibility violation to display.
 */
interface ViolationInfo {
    id: string;
    help: string;
}

/**
 * Manages visual feedback on the page during an accessibility scan.
 * Handles element highlights, violation banners, and report attachments.
 */
export class VisualReporter {
    private readonly overlayHostId = 'snap-ally-visual-root';
    private static readonly BANNER_ID = 'snap-ally-banner';
    private static readonly HIGHLIGHT_ID = 'snap-ally-highlight';
    private static readonly HIGHLIGHT_PADDING = 4;
    private static readonly BANNER_ALPHA = 0.85;
    private static readonly HIGHLIGHT_SHADOW_ALPHA = 0.3;
    private static readonly PAGE_LIFECYCLE_ERROR_PATTERNS = ['closed', 'destroyed', 'ended'];

    constructor(private readonly page: Page) {}

    async showBanner(violation: ViolationInfo, color: string): Promise<void> {
        await this.safeEvaluate(
            ([v, rawColor, rootId, bannerId, bannerAlpha]: [ViolationInfo, string, string, string, number]) => {
                const shadow = window.getOrCreateOverlayShadowRoot(rootId);
                let container = shadow.getElementById(bannerId);

                if (!container) {
                    const style = document.createElement('style');
                    style.textContent = `
                        #${bannerId} {
                            position: fixed;
                            left: 50%;
                            top: 24px;
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
                            transition: all 0.3s ease;
                        }
                        .badge {
                            background: rgba(255,255,255,0.2);
                            padding: 2px 8px;
                            border-radius: 6px;
                            font-size: 11px;
                            font-weight: 700;
                            text-transform: uppercase;
                            border: 1px solid rgba(255,255,255,0.2);
                        }
                        .content { flex: 1; line-height: 1.4; font-weight: 500; }
                    `;
                    shadow.appendChild(style);

                    container = document.createElement('div');
                    container.id = bannerId;
                    shadow.appendChild(container);
                }

                container.style.backgroundColor = window.addAlphaToColor(rawColor, bannerAlpha);
                container.innerHTML = `
                    <div style="font-size: 20px;">⚠️</div>
                    <div class="content">
                        <div style="margin-bottom:4px; display:flex; align-items:center; gap:8px;">
                            <span class="badge">${v.id}</span>
                            <span style="opacity: 0.9;">${v.help}</span>
                        </div>
                    </div>
                `;
            },
            [violation, color, this.overlayHostId, VisualReporter.BANNER_ID, VisualReporter.BANNER_ALPHA] as const
        );
    }

    async highlightElement(selector: string, color: string): Promise<void> {
        await this.safeEvaluate(
            ([sel, rawColor, rootId, highlightId, padding, shadowAlpha]: [string, string, string, string, number, number]) => {
                const target = document.querySelector(sel) as HTMLElement | null;
                if (!target) return;

                target.scrollIntoView({ behavior: 'auto', block: 'center' });

                const shadow = window.getOrCreateOverlayShadowRoot(rootId);
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
                            transition: all 0.2s ease;
                            box-shadow: 0 0 0 4px var(--c-alpha), 0 0 20px var(--c-alpha);
                        }
                    `;
                    shadow.appendChild(style);

                    highlight = document.createElement('div');
                    highlight.id = highlightId;
                    shadow.appendChild(highlight);
                }

                const rect = target.getBoundingClientRect();
                highlight.style.left = `${rect.left + window.scrollX - padding}px`;
                highlight.style.top = `${rect.top + window.scrollY - padding}px`;
                highlight.style.width = `${rect.width + padding * 2}px`;
                highlight.style.height = `${rect.height + padding * 2}px`;
                highlight.style.border = `3px solid ${rawColor}`;
                highlight.style.setProperty('--c-alpha', window.addAlphaToColor(rawColor, shadowAlpha));
            },
            [selector, color, this.overlayHostId, VisualReporter.HIGHLIGHT_ID, VisualReporter.HIGHLIGHT_PADDING, VisualReporter.HIGHLIGHT_SHADOW_ALPHA] as const
        );
    }

    async cleanupOverlay(): Promise<void> {
        await this.safeEvaluate((id: string) => document.getElementById(id)?.remove(), this.overlayHostId);
    }

    async removeHighlight(): Promise<void> {
        await this.safeEvaluate(
            ([rootId, hId]: [string, string]) => document.getElementById(rootId)?.shadowRoot?.getElementById(hId)?.remove(),
            [this.overlayHostId, VisualReporter.HIGHLIGHT_ID] as const
        );
    }

    async attachJsonData(testInfo: TestInfo, name: string, data: string): Promise<void> {
        await testInfo.attach(name, {
            contentType: 'application/json',
            body: Buffer.from(data),
        });
    }

    async captureScreenshot(testInfo: TestInfo, name: string): Promise<Buffer> {
        return await test.step('Capture A11y screenshot', async () => {
            const screenshot = await this.page.screenshot({ fullPage: false });
            await testInfo.attach(name, { contentType: 'image/png', body: screenshot });
            return screenshot;
        });
    }

    /**
     * Injects helper functions into the page context for overlay management.
     * These helpers are used by visual feedback operations (banner, highlight).
     */
    private async ensurePageHelpers(): Promise<void> {
        await this.page.evaluate(() => {
            type SnapAllyWindow = Window & {
                getOrCreateOverlayShadowRoot?: (id: string) => ShadowRoot;
                addAlphaToColor?: (color: string, alpha: number) => string;
            };

            const w = window as SnapAllyWindow;

            // Check if both helpers are already defined
            if (typeof w.getOrCreateOverlayShadowRoot === 'function' && typeof w.addAlphaToColor === 'function') {
                return;
            }

            w.getOrCreateOverlayShadowRoot = (id: string) => {
                let root = document.getElementById(id);
                if (!root) {
                    root = document.createElement('div');
                    root.id = id;
                    root.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;';
                    document.body.appendChild(root);
                    root.attachShadow({ mode: 'open' });
                }
                return root.shadowRoot!;
            };

            w.addAlphaToColor = (color: string, alpha: number) => {
                if (color.startsWith('rgba')) return color.replace(/[\d.]+\)$/, `${alpha})`);
                if (color.startsWith('rgb')) return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
                const hex = Math.round(alpha * 255).toString(16).padStart(2, '0');
                return `${color}${hex}`;
            };
        });
    }

    /**
     * Checks if an error message indicates a page lifecycle issue.
     */
    private isPageLifecycleError(message: string): boolean {
        const lowerMsg = message.toLowerCase();
        return VisualReporter.PAGE_LIFECYCLE_ERROR_PATTERNS.some(pattern => lowerMsg.includes(pattern));
    }

    /**
     * Executes a function in the page context with safety guarantees:
     * 1. Ensures overlay helper functions are injected before execution
     * 2. Gracefully handles page lifecycle errors (closed/destroyed pages)
     * 
     * @param fn - Function to execute in the page context
     * @param arg - Optional argument to pass to the function
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async safeEvaluate(fn: string | ((arg: any) => any), arg?: any): Promise<void> {
        try {
            await this.ensurePageHelpers();
            await (arg !== undefined ? this.page.evaluate(fn, arg) : this.page.evaluate(fn));
        } catch (e: unknown) {
            const msg: string = e instanceof Error ? e.message : String(e);
            if (this.isPageLifecycleError(msg)) return;
            throw e;
        }
    }
}

declare global {
    interface Window {
        getOrCreateOverlayShadowRoot: (id: string) => ShadowRoot;
        addAlphaToColor: (color: string, alpha: number) => string;
    }
}
