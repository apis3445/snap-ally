import { test } from '@playwright/test';
import { scanA11y } from '../src/A11yScanner';

test('local accessibility test', async ({ page }, testInfo) => {
    // Navigate to a page with known accessibility issues (or just a simple one)
    await page.goto('https://broken-accessibility.netlify.app/');

    // Test the scanner with different options
    await scanA11y(page, testInfo, {
        verbose: true,      // Hide from terminal
        consoleLog: true,   // Hide from browser console
        pageKey: 'LocalTest'
    });
});
