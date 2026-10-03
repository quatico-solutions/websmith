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

The default configuration uses the `tsconfig.json` file in your project root to compile the TypeScript files. Add a custom compilation config to the loader options or name a `websmith.config.json` file in the `configFile` option to configure the compilation output. The loader does not look for the file on its own.

#### Loader Options

- **tsConfigFile** (string): Path to the TypeScript configuration file. Defaults to `./tsconfig.json`.
- **tsConfig** (object): TypeScript compiler options. They override the options from the `tsconfig.json`. Like
  `tsconfig.json`, it accepts option names, e.g. `module: "NodeNext"`; an unknown name is a configuration error.
- **configFile** (string): Path to a `websmith.config.json`. Required to use the file: there is no automatic lookup.
  A `configFile` that does not exist is a configuration error. Without it, only the loader options apply.
- **config** (object): Websmith configuration (`addons`, `addonsDir`, `profiles`, `transpileOnly`, `addonEmitOnly`).
  It overrides the same keys of the file named in `configFile`. Define profiles for the loader in `config.profiles`.
  The `tsConfig` of a profile accepts option names too, and unknown names are configuration errors. A top-level
  `profiles` option is a configuration error: profiles belong in `config.profiles`.
- **debug** (boolean): Report messages and suggestions as warnings, in addition to errors and warnings. Defaults to
  `false`.
- **transpileOnly** (boolean): Enable transpile-only mode for faster builds without type checking. Defaults to
  `false`, or to `true` when the webpack configuration contains a `ForkTsCheckerWebpackPlugin`.
- **addonEmitOnly** (boolean): Only emit files that are processed by active addons. When enabled, all files are still compiled for dependencies and type checking, but only files processed by addon callbacks (generators, processors, transformers) are written to disk. This is useful for code generation workflows where you want to preserve original source files unchanged while emitting only generated or transformed files.
- **profile** (string): Name of the compilation profile to use. Without a profile, no profile addons are applied.
- **error** and **warn** (functions): Secondary sinks, called after the loader has emitted a diagnostic on the
  module: `error` receives each error, `warn` each warning, and with `debug` also each message and suggestion. Each
  gets a `WebpackError` whose message starts with the emitted file and position, `file (line,col): `. webpack
  reports the diagnostics and fails the build on errors whether these options are set or not. If you relied on
  `error` receiving every diagnostic, also handle warnings in `warn` and enable `debug` for messages.

TypeScript diagnostics and ESM check diagnostics are emitted on the module that produced them: errors fail the build
(`stats.hasErrors()`, webpack-cli exits 1), warnings do not. Messages and suggestions are emitted as warnings with
`debug` only. The TypeScript diagnostics are those of the module's emit, so these errors fail the build:

- syntax errors in `.ts`, `.tsx`, `.mts` and `.cts` files, under `transpileOnly: true` and `false`, also on the fast
  path without an addon that needs type information;
- declaration emit errors under `declaration: true` with `transpileOnly: false` and no addon that needs type
  information, e.g. TS4094 (property of an exported anonymous class type may not be private), TS2742 (inferred
  type cannot be named without a reference) and, under `isolatedDeclarations`, TS9xxx.

Configuration errors in `websmith.config.json` of the selected `profile` and the profiles it depends on fail the
build too, e.g. an unknown profile in `depends`, an unknown `esm.runtime`, or `esm` together with
`tsConfig.module: "CommonJS"`. A `configFile` that does not exist is a configuration error as well. Errors of
profiles the build does not use are not reported. Configuration errors belong to no module: the loader adds each one
once per compilation to webpack's errors and passes it to `error`, also when several loader rules use the same
configuration. A watch rebuild reports them again while they remain. Editing `websmith.config.json` triggers a
rebuild that reports its current errors and compiles the loader's modules again with the new configuration. Without
compiler hooks, e.g. under `thread-loader`, the loader emits the configuration errors on
every module it builds instead, so they appear once per module. With webpack's persistent cache
(`cache: { type: "filesystem" }`), a build that restores every module from the cache runs no loader and reports
no configuration errors.

#### Option resolution and addon lifetime

Each loader instance, i.e. each loader rule with its own options in each webpack compiler, resolves its options once:
it reads `websmith.config.json`, the `tsconfig.json` and the files the `tsconfig.json` extends when it compiles its
first module, and again only when one of these files changes. They are dependencies of every module the loader
compiles, so in watch mode an edit of any of them rebuilds these modules with the new options, and webpack's
persistent cache does not restore modules compiled with other versions of them. Before a repeated `compiler.run()`
without watch, and without compiler hooks, e.g. under `thread-loader`, before each module, the loader compares the
modification times of these files instead.

Addons are loaded and activated once per loader instance, not per module: an addon stays active for every module of
a compilation and across watch rebuilds while its files and the options are unchanged. After an edit of a file in
`addonsDir` or of the files above, the next rebuild loads and activates the addons again. Under `thread-loader`, each
worker looks for edits in `addonsDir` once per watch compilation, and at most once a second without watch. Addons
must not rely on being activated again for each module.

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

Each diagnostic points at the emitted file and names the module's source file, e.g.
`dist/a.js (1,18): ESM91001: "require" is not defined in ES module output (source "src/a.ts", profile "client").`

These rules run in the loader:

| Code | Loader |
|------|--------|
| 91001–91004, 91030–91033 | yes |
| 91005, 91013, 91020 | `runtime: "node"` only, as in the CLI |
| 91010, 91011 | `runtime: "node"` only; under `bundler`, webpack reports imports it cannot resolve as fully specified |
| 91012 | never; webpack reports imports it cannot resolve (*Module not found*) |
| 91021 | yes |
| 91022, 91023, 91024 | never; webpack resolves bare specifiers |

The `package.json` files the check reads, and the nearer ones it looked for but did not find, are registered as
dependencies of the module: in watch mode, changing a `"type"` or adding a `package.json` rebuilds the modules whose
classification depends on it. The `package.json` lookups are memoized per compilation; where the loader gets no
webpack compiler (e.g. under `thread-loader`), they are repeated for every module. webpack does not look at what changed, so **any** edit of such a `package.json`, e.g.
by `npm install`, rebuilds every module that depends on it; under `runtime: "node"` that is usually every module
below the project's `package.json`. Each rebuilt module costs what a changed module costs, which is dominated by
compiling the module, not by the check: in a benchmark of 1000 modules, a `"type"` flip rebuilt 701 modules in about
9.5 s, of which the check took about 110 ms. 91020 and 91021 resolve packages with Node's conditions (`node`, `import`,
`module-sync`, `default`), not webpack's `resolve.conditionNames`, so a package that webpack resolves to another
entry can be checked against the wrong one. TypeScript codes such as TS2835 are not labelled with the ESM check in
the loader.

The check's cost on watch rebuilds is measured by `pnpm perf:esm` in `packages/webpack-test`, a manual benchmark
that is not run in CI. It gates leaf edits on the rebuild time with the check against the rebuild time without it
(at most 1.10), and `"type"` flips on the check's time per rebuilt module against the same number of a `develop` run
(`--flip-budget`): without the check a flip rebuilds nothing, so the rebuild ratio would measure the correct new
rebuilds, not the check.

### Add websmith configuration

You can use a `websmith.config.json` file to configure which addons websmith uses for which profile during the webpack compilation process. Name the file in the `configFile` loader option and select a profile with the `profile` option:

```json
// websmith.config.json
{
    "addonsDir": "./addons",
    "profiles": {
        "client": {
            "addons": ["my-addon"]
        }
    }
}
```

```javascript
// ./webpack.config.js
options: {
    configFile: join(__dirname, "websmith.config.json"),
    profile: "client",
},
```

A profile may contain `depends`, `addons`, `config`, `tsConfig` and `esm`. The profile name is free; the loader expects no particular name.

Read more about compilation profiles in the [websmith compiler documentation](https://github.com/quatico-solutions/websmith/tree/develop/packages/compiler/README.md#compilation-profiles). Or check out more details on the configuration file in the [compiler documentation](https://github.com/quatico-solutions/websmith/tree/develop/packages/compiler/README.md#websmith-configuration-file).
