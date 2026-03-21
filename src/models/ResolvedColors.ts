/** Resolved severity color palette. */
export interface ResolvedColors {
    critical: string;
    serious: string;
    moderate: string;
    minor: string;
}

/** Default severity colors used when the user doesn't override them. */
export const DEFAULT_COLORS: Readonly<ResolvedColors> = {
    critical: '#dc2626', // Power Red
    serious: '#ea580c',  // Deep Orange
    moderate: '#f59e0b', // Amber/Honey
    minor: '#f0f06f',    // Ocean Blue (Updated to Yellow per user request)
};

/** Default fallback color for unknown severities. */
export const FALLBACK_GRAY = '#757575';

/**
 * Maps an Axe 'impact' level to its corresponding hex color.
 * Supports optional custom color overrides.
 */
export function getSeverityColor(impact?: string | null, customColors?: Partial<ResolvedColors>): string {
    const level = (impact || 'minor') as keyof ResolvedColors;
    if (customColors && customColors[level]) {
        return customColors[level]!;
    }
    return DEFAULT_COLORS[level] || FALLBACK_GRAY;
}
