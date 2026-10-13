/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

/**
 * Returns whether websmith compiles the module `id`: never a virtual module (`\0` prefix) or an id with a query,
 * e.g. `?raw`, `?url` or `?vue&type=script`, otherwise the ids `filter` accepts.
 */
export const isCompiledId = (id: string, filter: (id: string) => boolean): boolean => !id.startsWith("\0") && !id.includes("?") && filter(id);
