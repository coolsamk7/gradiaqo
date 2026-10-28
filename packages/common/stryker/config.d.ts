export interface MutationThresholds {
    /** At or above: green. */
    high: number;
    /** Below: red. */
    low: number;
    /** Below: the run fails. null: never fails. */
    break: number | null;
}

export interface StrykerOptions {
    thresholds?: Partial<MutationThresholds>;
    /** Extra globs (relative to the package) not to mutate. */
    ignore?: string[];
    /** Parallel test runners. Default: Stryker's (CPU cores - 1). */
    concurrency?: number;
}

/** Stryker settings shared by every Gradiaqo app and package. See config.js. */
export function strykerConfig( options?: StrykerOptions ): Record<string, unknown>;
