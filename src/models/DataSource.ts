/** Union of the two shapes that can carry data in Playwright results. */
export type DataSource =
    | { type: 'attachment'; data: { name: string; body?: Buffer; path?: string } }
    | { type: 'annotation'; data: { type: string; description?: string } };
