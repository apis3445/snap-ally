/**
 * Time utility functions for formatting test durations.
 */
export class TimeUtils {
    /**
     * Formats milliseconds into a human-readable duration string.
     */
    static formatDuration(ms: number): string {
        if (ms < 1000) {
            return `${ms.toFixed(0)}ms`;
        }

        const seconds = ms / 1000;
        if (seconds < 60) {
            return `${seconds.toFixed(1)}s`;
        }

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
    }

    /**
     * Formats a Date object into a human-readable string.
     */
    static formatDate(date: Date): string {
        const parts = new Intl.DateTimeFormat('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).formatToParts(date);

        const get = (type: string) => parts.find((p) => p.type === type)?.value || '';

        return `${get('month')} ${get('day')}, ${get('year')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`;
    }
}
