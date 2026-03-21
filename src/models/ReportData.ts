import { Violation } from './Violation';

/** Complete data structure for an individual accessibility report. */
export interface ReportData {
    pageKey: string;
    pageUrl?: string;
    /** No longer used; accessibility score derivation from Lighthouse removed. */
    accessibilityScore: number;
    /** Relative paths to videos for this a11y scan. */
    video?: string | string[];
    /** List of accessibility violations found. */
    a11yErrors: Violation[];
    /** Severity level colors used in the report. */
    criticalColor: string;
    seriousColor: string;
    moderateColor: string;
    minorColor: string;
    /** ADO integration details. */
    adoOrganization?: string;
    adoProject?: string;
    adoAreaPath?: string;
    adoPat?: string;
    /** Execution timestamp. */
    timestamp?: string;
}
