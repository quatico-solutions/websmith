/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";

// Node18 and Node20 exist only in TypeScript 6, so the members are looked up by name in the installed ts.ModuleKind
const NODE_MODULE_KIND_NAMES = ["Node16", "Node18", "Node20", "NodeNext"];

/**
 * True when `module` is a node module kind (node16, node18, node20, nodenext) of `moduleKinds`, under which the
 * extension and the nearest package.json decide a file's module format.
 */
export const isNodeModuleKind = (module: ts.ModuleKind | undefined, moduleKinds: Record<string, string | number> = ts.ModuleKind): boolean =>
    module !== undefined && NODE_MODULE_KIND_NAMES.some(name => name in moduleKinds && moduleKinds[name] === module);
