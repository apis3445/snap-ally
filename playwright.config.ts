import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
        ['html'],
        [
            './src/SnapAllyReporter.ts',
            {
                outputFolder: 'steps-report',
                colors: {
                    critical: '#ff0000',
                    serious: '#00ff00',
                    moderate: '#0000ff',
                    minor: '#f0f06f',
                },
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
    ],
});
