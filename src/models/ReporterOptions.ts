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
     * Azure DevOps integration options.
     */
    ado?: {
        organization?: string;
        project?: string;
        areaPath?: string;
    };
}
