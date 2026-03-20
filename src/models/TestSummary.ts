import { TestResults } from './TestResults';

/** Final execution summary data structure. */
export interface TestSummary {
    date?: string;
    duration: string;
    status: string;
    statusIcon: string;
    total: number;
    totalPassed: number;
    totalFailed: number;
    totalFlaky: number;
    totalSkipped: number;
    groupedResults: { [key: string]: TestResults[]; };
    wcagErrors: {
        [key: string]: { count: number; severity: string; helpUrl?: string; description?: string; };
    };
    totalA11yErrorCount: number;
    browserSummaries?: { [browser: string]: TestSummary; };
    colors?: {
        critical?: string;
        serious?: string;
        moderate?: string;
        minor?: string;
    };
}
