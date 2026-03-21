/** Resolved severity color palette. */
export interface ResolvedColors {
    critical: string;
    serious: string;
    moderate: string;
    minor: string;
}

/** Default severity colors used when the user doesn't override them. */
export const DEFAULT_COLORS: Readonly<ResolvedColors> = {
    critical: '#b91c1c', // Deep Red
    serious: '#c2410c',  // Deep Orange
    moderate: '#a16207', // Dark Amber
    minor: '#1e40af',    // Royal Blue
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
