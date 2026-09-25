/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type ts from "typescript";

/**
 * This type represents the configuration options for a profile. It is used in
 * the `profiles` section of the `websmith.config.json` file. You can specify
 *  - `depends`: the list of dependencies to other profiles to be applied
 *  - `addons`: the list of addons to apply for this profile
 *  - `config`: profile specific configuration
 *  - `tsConfig`: compiler options for the TypeScript compiler for this profile
 *  - `esm`: ESM compatibility check for the JavaScript this profile emits
 */
export type CompilationProfile = {
    /** List of dependencies to other profiles to be applied, before this profile is applied. */
    depends?: string[];
    /** List of addons to be loaded. */
    addons?: string[];
    /** Profile specific configuration. */
    config?: unknown;
    /** Compiler options for the TypeScript compiler for this profile. */
    tsConfig?: ts.CompilerOptions;
    /**
     * ESM compatibility check for the emitted JavaScript of this profile. Profiles without `esm` are not checked.
     * Not inherited through `depends`.
     */
    esm?: EsmProfileOptions;
};

/** The runtime that loads the emitted JavaScript and decides whether a file is an ES module. */
export type EsmRuntime = "node" | "bundler";

/** Severity of ESM check findings: `error` fails the build, `warn` reports warnings, `off` skips the check. */
export type EsmCheckLevel = "error" | "warn" | "off";

export type EsmProfileOptions = {
    /** `node` classifies files like Node.js, `bundler` like webpack's module types. */
    runtime: EsmRuntime;
    /** Severity of findings, defaults to `error`. */
    check?: EsmCheckLevel;
    /** Glob patterns (`*`, `**`, `?`) of emitted files to skip, relative to the directory of `websmith.config.json` unless absolute. */
    ignore?: string[];
};
