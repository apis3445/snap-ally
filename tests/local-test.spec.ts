import { test } from '@playwright/test';
import { scanA11y } from '../src/core/Scanner';

test.describe('Page A11y', {
    tag: ['@PageAccessibility'],
}, () => {

    test('local accessibility test', async ({ page }, testInfo) => {
        const pageToTest = 'https://www.google.com';

        // Navigate to a page with known accessibility issues (or just a simple one)
        await test.step('Go to: ' + pageToTest, async () => {
            await page.goto(pageToTest);
        });

        // Test the scanner with different options
        await scanA11y(page, testInfo, {
            verbose: true,      // Show in terminal
            consoleLog: true,   // Show in browser console
            pageKey: 'LocalTest',
            ado: {
                organization: 'wbi1521',
                project: 'Angular'
            }
        });

    });
});