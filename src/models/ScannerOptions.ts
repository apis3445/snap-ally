import type { Locator } from '@playwright/test';

/**
 * Options for the accessibility scanner.
 */
export interface ScannerOptions {
    /** Specific selector or locator to include in the scan. */
    include?: string | Locator;
    /** Alias for include. */
    box?: string | Locator;

    /** Whether to log violations to the console. @default true */
    verbose?: boolean;
    /** Alias for verbose. */
    consoleLog?: boolean;

    /** Specific Axe rules to enable or disable. */
    rules?: Record<string, { enabled: boolean; }>;
    /** Specific WCAG tags to check (e.g., ['wcag2a', 'wcag2aa']). */
    tags?: string[];
    /** Any other Axe-core options to pass to the builder. */
    axeOptions?: Record<string, unknown>;
    /** Custom identifier for the report file name. */
    pageKey?: string;

    /** Azure DevOps integration options for bug reporting. */
    ado?: {
        organization?: string;
        project?: string;
        areaPath?: string;
    };
}
