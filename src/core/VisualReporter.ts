import { type Disposable, type Page, type TestInfo, test } from '@playwright/test';
import { BannerInfo } from '../models';

/**
 * Manages visual feedback on the page during an accessibility scan.
 * Handles element highlights, violation banners, and report attachments.
 */
export class VisualReporter {
    private readonly HIGHLIGHT_PADDING = 4;
    private readonly BANNER_ALPHA = 0.85;

    private static readonly BANNER_STYLE = `
        position: absolute;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        width: fit-content;
        max-width: 600px;
        padding: 12px 18px;
        border-radius: 12px;
        color: white;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        z-index: 10000;
    `;

    private static readonly BADGE_STYLE = `
        background: rgba(255,255,255,0.2);
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
    `;

    private static readonly HIGHLIGHT_STYLE = `
        border-radius: 8px;
        box-sizing: border-box;
        pointer-events: none;
        z-index: 9999;
    `;

    private bannerOverlay: Disposable | null = null;
    private actionsOverlay: Disposable | null = null;
    private highlightOverlay: Disposable | null = null;

    constructor(private readonly page: Page) {}

    /**
     * Applies alpha transparency to a CSS color string (hex, rgb, hsl, or named color).
     */
    private addAlphaToColor(color: string, alpha: number): string {
        return `color-mix(in srgb, ${color} ${alpha * 100}%, transparent)`;
    }

    async showBanner(violation: BannerInfo): Promise<void> {
        this.actionsOverlay = await this.page.screencast.showActions({ position: 'top' });
        const backgroundColor = this.addAlphaToColor(violation.color, this.BANNER_ALPHA);
        const bannerHtml = `
            <div style="${VisualReporter.BANNER_STYLE} background-color: ${backgroundColor};">
                <div style="flex: 1; line-height: 1.4; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                    <span style="${VisualReporter.BADGE_STYLE}">${violation.id}</span>
                    <span style="opacity: 0.9;">${violation.help}</span>
                </div>
            </div>
        `;
        this.bannerOverlay = await this.page.screencast.showOverlay(bannerHtml);
    }

    async highlightElement(selector: string, color: string): Promise<void> {
        await test.step(`Highlight element: ${selector}`, async () => {
            const locator = this.page.locator(selector);
            await locator.scrollIntoViewIfNeeded();

            const box = await locator.boundingBox();
            // eslint-disable-next-line playwright/no-conditional-in-test
            if (!box) return;

            const padding = this.HIGHLIGHT_PADDING;
            const highlightHtml = `
            <div style="
                position: fixed;
                left: ${box.x - padding}px;
                top: ${box.y - padding}px;
                width: ${box.width + padding * 2}px;
                height: ${box.height + padding * 2}px;
                border: 3px solid ${color};
                ${VisualReporter.HIGHLIGHT_STYLE}
            "></div>
        `;
            this.highlightOverlay = await this.page.screencast.showOverlay(highlightHtml);
        });
    }

    async cleanupOverlay(): Promise<void> {
        await this.bannerOverlay?.dispose();
        await this.actionsOverlay?.dispose();
        this.bannerOverlay = null;
        this.actionsOverlay = null;
    }

    async removeHighlight(): Promise<void> {
        await this.highlightOverlay?.dispose();
        this.highlightOverlay = null;
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
}
