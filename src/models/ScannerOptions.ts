/**
 * Options for the accessibility scanner.
 */
export interface ScannerOptions {
    /**
     * CSS selector to limit the scan to. Must be a string: AxeBuilder only
     * accepts selector strings, not Playwright Locators.
     */
    include?: string;
    /** Alias for include. */
    box?: string;

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
