<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->
# websmith-loader

A drop-in replacement for the [ts-loader](https://github.com/TypeStrong/ts-loader#readme) to add the websmith compiler to your build and bundling process. Websmith provides an [API to create compiler addons](https://github.com/quatico-solutions/websmith/tree/develop/packages/api#readme) to modify the compilation input before, during and after compiled artifacts are created, [compilation profiles](https://github.com/quatico-solutions/websmith/tree/develop/packages/compiler/README.md#compilation-profiles) to specify individual environments for different outputs, and integrates seamlessly with `webpack` build commands.

Visit the [websmith github repository](https://github.com/quatico-solutions/websmith#readme) for more information and examples.

## Getting started

Whenever you use the `ts-loader` to compile your TypeScript project, you can replace it with the `websmith-loader` command and apply compiler addons.

### Installation

Add the loader to your TypeScript project with the `websmith-loader` package. For example, use the following command with `pnpm`:

```sh
pnpm add --dev websmith-loader
```

### Use websmith-loader in your webpack configuration

You can use the `websmith-loader` loader in your webpack configuration by adding the following entry to your `module.rules` configuration:

```javascript
// ./webpack.config.js
const { join } = require("path");

module.exports = {
    // ...
    module: {
        rules: [
            {
                test: /\.(?:[j|t]sx?)$/,
                use: [
                    {
                        loader: "websmith-loader",
                        options: {
                            tsConfigFile: join(__dirname, "tsconfig.json"),
                            config: {
                                addonsDir: join(__dirname, "addons"),
                                addons: ["export-yaml-generator"],
                            },
                            transpileOnly: true,
                            addonEmitOnly: false, // Set to true to only emit files processed by addons
                        },
                    },
                ],
            },
            // ...
        ],
    },
};
```

The default configuration uses the `tsconfig.json` file in your project root to compile the TypeScript files. Add a custom compilation config to the loader options or use the `websmith.config.json` file to configure the compilation output.

#### Loader Options

- **tsConfigFile** (string): Path to the TypeScript configuration file
- **config** (object): Websmith configuration (can also be loaded from `websmith.config.json`)
- **transpileOnly** (boolean): Enable transpile-only mode for faster builds without type checking
- **addonEmitOnly** (boolean): Only emit files that are processed by active addons. When enabled, all files are still compiled for dependencies and type checking, but only files processed by addon callbacks (generators, processors, transformers) are written to disk. This is useful for code generation workflows where you want to preserve original source files unchanged while emitting only generated or transformed files.
- **profile** (string): Name of the compilation profile to use
- **error** and **warn** (functions): Secondary sinks, called after the loader has emitted a diagnostic on the
  module: `error` receives each error, `warn` each warning, and with `debug` also each message and suggestion. Each
  gets a `WebpackError` whose message starts with the emitted file and position, `file (line,col): `. webpack
  reports the diagnostics and fails the build on errors whether these options are set or not.

TypeScript diagnostics and ESM check diagnostics are emitted on the module that produced them: errors fail the build
(`stats.hasErrors()`, webpack-cli exits 1), warnings do not. Messages and suggestions are emitted as warnings with
`debug` only. The TypeScript diagnostics are those of the module's emit, so these errors fail the build:

- syntax errors under `transpileOnly: false`;
- declaration emit errors under `declaration: true` with `transpileOnly: false` and no addon that needs type
  information, e.g. TS4094 (property of an exported anonymous class type may not be private), TS2742 (inferred
  type cannot be named without a reference) and, under `isolatedDeclarations`, TS9xxx.

#### `.mts` and `.cts` files

The loader compiles `.mts` and `.cts` files to `.mjs` and `.cjs` output and attaches their source maps. Add the
extensions to your loader rule and to `resolve.extensions`:

```javascript
// ./webpack.config.js
module.exports = {
    resolve: { extensions: [".ts", ".mts", ".cts", ".js"] },
    module: { rules: [{ test: /\.[cm]?tsx?$/, use: ["websmith-loader"] }] },
};
```

#### ESM check

A profile with `esm` gets the [ESM check](https://github.com/quatico-solutions/websmith/tree/develop/packages/compiler/README.md#esm-check)
in the loader too. It runs once per module, when webpack builds it, so each diagnostic belongs to its module, stays
reported while webpack caches the module, and a watch rebuild of the module checks it again. `esm` is not inherited
through `depends`: the webpack profile and its dependent profiles are checked by their own `esm`.

- **The webpack profile**: the check reads the JavaScript webpack bundles, also under `addonEmitOnly`. Under
  `runtime: "bundler"` it classifies the module by webpack's module type: `javascript/esm`, `javascript/dynamic` or
  `javascript/auto`. webpack's default rules key on `.mjs`, `.cjs` and `.js` files, not on `.ts`, `.mts` or `.cts`, so
  a TypeScript module is `javascript/auto` unless a rule sets `type`, e.g. `type: "javascript/esm"`. Where webpack does
  not tell the type (e.g. under `thread-loader`), the module is classified by its file name and `package.json` like
  in the CLI. Under `runtime: "node"` the files are classified the way Node loads them, since the loader also writes
  them to `outDir`.
- **Dependent profiles** (`depends`): the check reads the files they write, classified by their own `runtime`.

These rules run in the loader:

| Code | Loader |
|------|--------|
| 91001–91004, 91030–91033 | yes |
| 91005, 91013, 91020 | `runtime: "node"` only, as in the CLI |
| 91010, 91011 | `runtime: "node"` only; under `bundler`, webpack reports imports it cannot resolve as fully specified |
| 91012 | never; webpack reports imports it cannot resolve (*Module not found*) |
| 91021 | yes |

The `package.json` files the check reads, and the nearer ones it looked for but did not find, are registered as
dependencies of the module: in watch mode, changing a `"type"` or adding a `package.json` rebuilds the modules whose
classification depends on it. The `package.json` lookups are memoized per compilation; where the loader gets no
webpack compiler (e.g. under `thread-loader`), they are repeated for every module. webpack does not look at what changed, so **any** edit of such a `package.json`, e.g.
by `npm install`, rebuilds every module that depends on it; under `runtime: "node"` that is usually every module
below the project's `package.json`. Each rebuilt module costs what a changed module costs, which is dominated by the
loader's per-module option resolution, not by the check: in a benchmark of 1000 modules, a `"type"` flip rebuilt 701
modules in about 208 s, of which the check took 58 ms. 91020 and 91021 resolve packages with Node's conditions (`node`, `import`,
`module-sync`, `default`), not webpack's `resolve.conditionNames`, so a package that webpack resolves to another
entry can be checked against the wrong one. TypeScript codes such as TS2835 are not labelled with the ESM check in
the loader.

The check's cost on watch rebuilds is measured by `pnpm perf:esm` in `packages/webpack-test`, a manual benchmark
that is not run in CI. It gates leaf edits on the rebuild time with the check against the rebuild time without it
(at most 1.10), and `"type"` flips on the check's share of the rebuild time (at most 10%): without the check a flip
rebuilds nothing, so the rebuild ratio would measure the correct new rebuilds, not the check.

### Add websmith configuration

You can use a `websmith.config.json` file to configure which addons should be used for what profile by websmith during the webpack compilation process:

```json
// websmith.config.json
{
    "profiles": {
        "executeAddons": {
            "addons": ["my-addon"],
        },
    }
}
```

**Note:** The webpack loader will expect a profile called `executeAddons` which we need to configure in the webpack configuration.

Read more about compilation profiles in the [websmith compiler documentation](https://github.com/quatico-solutions/websmith/tree/develop/packages/compiler/README.md#compilation-profiles). Or check out more details on the configuration file in the [compiler documentation](https://github.com/quatico-solutions/websmith/tree/develop/packages/compiler/README.md#websmith-configuration-file).
