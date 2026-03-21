// ────────────────────────────────────────────────────────────────────────────
//  Public options interface
// ────────────────────────────────────────────────────────────────────────────

export interface ReporterOptions {
    /**
     * Folder where the reports will be generated.
     * @default "steps-report"
     */
    outputFolder?: string;

    /**
     * Custom colors for violation severities in the report.
     */
    colors?: {
        critical?: string;
        serious?: string;
        moderate?: string;
        minor?: string;
    };

    /**
     * Whether to log violations to the terminal.
     * @default true
     */
    verbose?: boolean;

    /**
     * Whether to log violations to the browser console.
     * @default true
     */
    consoleLog?: boolean;

    /**
     * Azure DevOps integration options.
     */
    ado?: {
        organization?: string;
        project?: string;
        areaPath?: string;
    };
}
