import { Target } from './Target';

/** Grouped error entry for a specific accessibility violation. */
export interface Violation {
    id: string;
    description: string;
    wcagRule: string;
    severity: string;
    help: string;
    helpUrl: string;
    guideline: string;
    total: number;
    target: Target[];
    /** URL of the page that was scanned when this violation was found. */
    pageUrl?: string;
    /** Sanitized key of the page that was scanned when this violation was found. */
    pageKey?: string;
}
