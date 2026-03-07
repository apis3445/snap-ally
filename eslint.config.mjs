import playwright from 'eslint-plugin-playwright';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

// Import recommended config objects for flat config
const tsRecommended = tseslint.configs.recommended;
const playwrightRecommended = playwright.configs['flat/recommended'];

export default [
    {
        // Ignores some config files and custom reporters
        ignores: [
            '**/dist/**',
            '**/node_modules/**',
            '**/playwright-report/**',
            '**/test-results/**',
            '**/steps-report/**',
            '**/blob-report/**',
            'checkly.config.ts',
            'eslint.config.mjs',
            'video.webm',
        ],
    },
    {
        files: ['**/*.ts', '**/*.js'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
        },
        // Explicitly declare both plugins for the rules below
        plugins: {
            '@typescript-eslint': tseslint,
            playwright: playwright,
        },
        rules: {
            ...tsRecommended.rules,
            ...playwrightRecommended.rules,
            // Code formats aligned with Prettier
            indent: ['error', 4, { SwitchCase: 1 }],
            'linebreak-style': ['error', 'unix'],
            quotes: ['error', 'single'],
            semi: ['error', 'always'],
            '@typescript-eslint/no-explicit-any': 'warn',
            'playwright/no-skipped-test': 'warn',
        },
    },
];
