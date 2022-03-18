/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
import ts from "typescript";

export const tsDefaults: ts.CompilerOptions = {
    ...ts.getDefaultCompilerOptions(),
    esModuleInterop: true,
    jsx: ts.JsxEmit.React,
    module: ts.ModuleKind.ES2015,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    strict: true,
    target: ts.ScriptTarget.Latest,
};

/**
 * TypeScript knows the types of variables and functions through the use of
 * declaration files (.d.ts extension). These are what you download when
 * you install a package from DefinitelyTyped (@types/package).
 *
 * Since there are many different versions of TypeScript/JavaScript, the
 * types of core language features are not baked into the compiler.
 * Declaration files for the languages features you want to use must be
 * included in the virtual file system. This is what the lib field in
 * your tsconfig.json file configures.
 *
 * By defaults we will use es2015 and dom features, equivalent to
 * <pre><code>
 *  // tsconfig.json
 * {
 *   // ...
 *  "lib": ["es2015", "dom"]
 * }
 * </code></pre>
 *
 * The declaration files are in node_modules and can be loaded at build
 * time using the Webpack raw-loader.
 */
export const tsLibDefaults: { [name: string]: string } = {
    "/lib.es2015.d.ts": require("!!raw-loader!typescript/lib/lib.es2015.d.ts"),
    "/lib.es2015.collection.d.ts": require("!!raw-loader!typescript/lib/lib.es2015.collection.d.ts"),
    "/lib.es2015.core.d.ts": require("!!raw-loader!typescript/lib/lib.es2015.core.d.ts"),
    "/lib.es2015.generator.d.ts": require("!!raw-loader!typescript/lib/lib.es2015.generator.d.ts"),
    "/lib.es2015.iterable.d.ts": require("!!raw-loader!typescript/lib/lib.es2015.iterable.d.ts"),
    "/lib.es2015.promise.d.ts": require("!!raw-loader!typescript/lib/lib.es2015.promise.d.ts"),
    "/lib.es2015.proxy.d.ts": require("!!raw-loader!typescript/lib/lib.es2015.proxy.d.ts"),
    "/lib.es2015.reflect.d.ts": require("!!raw-loader!typescript/lib/lib.es2015.reflect.d.ts"),
    "/lib.es2015.symbol.d.ts": require("!!raw-loader!typescript/lib/lib.es2015.symbol.d.ts"),
    "/lib.es2015.symbol.wellknown.d.ts": require("!!raw-loader!typescript/lib/lib.es2015.symbol.wellknown.d.ts"),
    "/lib.es5.d.ts": require("!!raw-loader!typescript/lib/lib.es5.d.ts"),
    "/lib.dom.d.ts": require("!!raw-loader!typescript/lib/lib.dom.d.ts"),
};
