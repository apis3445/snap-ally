/** Individual element that failed a specific accessibility rule. */

export interface Target {
    element: string;
    snippet: string;
    html: string;
    screenshot: string;
    steps: string[];
    stepsJson: string;
    screenshotBase64: string;
}
