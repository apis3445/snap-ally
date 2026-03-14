import { test } from '@playwright/test';
import { scanA11y } from '../src/A11yScanner';

test.describe('Page A11y', {
    tag: ['@PageAccessibility'],
}, () => {

    test('local accessibility test', async ({ page }, testInfo) => {
        const pageToTest = 'https://abi-testing-dojo-demo.azurewebsites.net/';

        // Navigate to a page with known accessibility issues (or just a simple one)
        await test.step('Go to: ' + pageToTest, async () => {
            await page.goto(pageToTest);
        });

        // Test the scanner with different options
        await scanA11y(page, testInfo, {
            verbose: true,      // Hide from terminal
            consoleLog: true,   // Hide from browser console
            pageKey: 'LocalTest'
        });
    });
});