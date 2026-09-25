export interface CoverageThresholds {
    lines?: number;
    branches?: number;
    functions?: number;
    statements?: number;
}

export interface CoverageOptions {
    /** Fail the run below these percentages. Default: 100 for every metric. */
    thresholds?: CoverageThresholds;
    /** Extra globs to leave out of the report. */
    exclude?: string[];
}

/** Vitest `test.coverage` settings shared by every StudyLog app and package. See coverage.js. */
export function coverageConfig( options?: CoverageOptions ): {
    provider: 'v8';
    include: string[];
    exclude: string[];
    reporter: string[];
    reportsDirectory: string;
    thresholds: CoverageThresholds;
};
