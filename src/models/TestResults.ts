import { Violation } from './Violation';

/** Aggregated results for a single test run. */
export interface TestResults {
    num: number;
    folderName: string;
    title: string;
    fileName: string;
    timeDuration: number;
    duration: string;
    description: string;
    status: string;
    pageUrl?: string;
    browser: string;
    adoOrganization?: string;
    adoProject?: string;
    adoAreaPath?: string;
    timestamp?: string;
    tags: string[];
    preConditions: string[];
    steps: string[];
    postConditions: string[];
    statusIcon: string;
    /** Relative paths to videos for the test execution. */
    videoPath: string | string[] | null;
    screenshotPaths: string[];
    attachments: { path: string; name: string }[];
    errors: string[];
    a11yReportPath?: string;
    executionReportPath?: string;
    a11yErrors?: Violation[];
    a11yErrorCount?: number;
    colors?: {
        critical?: string;
        serious?: string;
        moderate?: string;
        minor?: string;
    };
}


