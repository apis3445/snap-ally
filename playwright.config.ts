import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
        ['html', { open: 'never', attachments: 'all' }],
        [
            './src/SnapAllyReporter.ts',
            {
                outputFolder: 'steps-report',
                ado: {
                    organization: 'wbi1521',
                    project: 'Angular',
                    areaPath: 'Angular'
                }
            },
        ],
    ],
    use: {
        trace: 'on-first-retry',
        video: 'on',
        screenshot: 'on',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'desktop-firefox',
            use: {
                ...devices['Desktop Firefox']
            }
        },
        {
            name: 'desktop-webkit',
            use: {
                ...devices['Desktop Safari'],
            },
        },

    ],
});
