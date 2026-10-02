/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

/** An output file an ESM check received: its path, resolved by the checking compiler's system, and its text. */
export interface EsmCheckRecord {
    path: string;
    text: string;
}

interface EsmCheckRegistry {
    windows: Array<{ records: EsmCheckRecord[] }>;
}

// Held on globalThis under a registered symbol, so two copies of websmith-core in one process share it; the shape is
// plain objects and arrays only, as two versions of core may read it
const KEY = Symbol.for("@quatico/websmith-core/esm-check");

const getRegistry = (): EsmCheckRegistry | undefined => {
    const registry = (globalThis as Record<symbol, unknown>)[KEY] as EsmCheckRegistry | undefined;
    return Array.isArray(registry?.windows) ? registry : undefined;
};

/**
 * Runs `fn` with a window open and returns the files every ESM check recorded while it ran, including the checks of
 * windows opened inside it. The window is closed when `fn` throws, and the registry removed once no window is open.
 */
export const collectEsmChecks = (fn: () => void): EsmCheckRecord[] => {
    const registry = getRegistry() ?? { windows: [] };
    (globalThis as Record<symbol, unknown>)[KEY] = registry;
    const window = { records: [] as EsmCheckRecord[] };
    registry.windows.push(window);
    try {
        fn();
    } finally {
        const index = registry.windows.lastIndexOf(window);
        if (index >= 0) {
            registry.windows.splice(index, 1);
        }
        if (registry.windows.length === 0) {
            delete (globalThis as Record<symbol, unknown>)[KEY];
        }
    }
    return window.records;
};

/** Records a file an ESM check received in every open window; outside a window it records nothing. */
export const recordEsmCheck = (record: EsmCheckRecord): void => {
    getRegistry()?.windows.forEach(cur => cur.records.push({ path: record.path, text: record.text }));
};
