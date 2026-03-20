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
}
