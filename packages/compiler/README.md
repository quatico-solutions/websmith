<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->
# @quatico/websmith-compiler

Websmith is a compiler frontend for the [TypeScript compiler](https://github.com/microsoft/TypeScript). It's a drop-in replacement for the `tsc` command with additional customization options for the compilation output. It provides an [API to create compiler addons](https://github.com/quatico-solutions/websmith/tree/develop/packages/api/README.md) to modify the compilation input before, during and after compiled artifacts are created, [compilation profiles](#compilation-profiles) to specify individual environments for different outputs, and integrates seamlessly with the `tsc` and `webpack` build commands.

## Getting started

Whenever you use the `tsc` command to compile your TypeScript project, you can replace it with the `websmith` command and apply compiler addons.

### Installation

Add websmith to your TypeScript project with the `@quatico/websmith-compiler` package. For example, use the following command with `pnpm`:

```bash
pnpm add --dev @quatico/websmith-compiler
```

If you don't have added the "typescript" dependency yet, add it to your project too.

### Use websmith as build command

Run the compiler as binary via NodeJS with the following command:

```bash
websmith
```

The default configuration uses the `tsconfig.json` file in your project root to compile the TypeScript files. Customize the compilation output with CLI arguments (e.g., `--addons`) or in the `websmith.config.json`.

Websmith provides a high performance watch mode options, similar to the `ts-loader` for webpack:

```bash
websmith --transpileOnly --watch
```

### Bundled Version

For environments where ES module resolution issues occur, websmith provides a bundled version that includes all dependencies in a single executable file:

```bash
websmith-bundled
```

The bundled version is built using webpack and provides the same functionality as the regular websmith command while avoiding module resolution conflicts. This is particularly useful in complex monorepo setups or when dealing with mixed ES module/CommonJS environments.

### Use websmith in your package.json

In your package.json, add the `websmith` command as your build target to the `scripts` section:

```json
// ./package.json
{
    "scripts": {
        "build": "websmith",
    },
    //...
}
```

Just as the `tsc` command the default `tsconfig.json` file in your project root is used to compile the TypeScript files. The same CLI arguments can be used to configure the output.

### Use websmith with webpack

You can use `websmith-loader` as drop-in replacement for the `ts-loader` to apply websmith addons to your TypeScript files. Read more about the [websmith-loader](https://github.com/quatico-solutions/websmith/tree/develop/packages/webpack/README.md) in the webpack package.

## Compiler addons

Compiler addons can be used to modify the compilation artifacts before, during and after the compiled output is created. Even non-script files can be created and processed in the compilation process. Read more about [compiler addons](https://github.com/quatico-solutions/websmith/tree/develop/packages/api/README.md) in the API package.

Addons written in TypeScript are compiled to CommonJS in `.websmith-cache/addons-cli` next to your `tsconfig.json`, so they also load in projects with `"type": "module"`. Add `.websmith-cache/` to your `.gitignore`. Addons should import only files inside the addons directory or packages installed in your project: compiled addons resolve imports from the cache directory, so relative imports that leave the addons directory and packages installed only next to the addons do not resolve.

## Command line parameters

The `websmith` command supports the same command line parameters as the `tsc` command. In addition, it supports parameters to customize the compilation output, like:

* `--addons <addons>`: Comma-separated list of addons to apply. No addons are applied by default.
* `--addonEmitOnly`: Only emit files that are processed by active addons. All files are still compiled for type checking and dependencies, but only addon-processed files are written to disk. This is useful for code generation workflows where you want to preserve original source files unchanged while emitting only generated or transformed files. Can be combined with `--transpileOnly` for fast builds without type checking.
* `--addonsDir <directoryPath>`: Directory path to the "addons" folder. Defaults to `./addons`.
* `--configFile <filePath>`: File path to the "websmith.config.json". Defaults to `./websmith.config.json`.
* `--debug`: Enable the output of debug information.
* `--profile <profileName>`: Name of the profile to use with a specific compiler configuration and list of addons. No profile is applied by default.
* `--transpileOnly`: Enable the transpile only mode.

See all available parameters with the `websmith --help` command.

## <a name="compilation-profiles"></a>Compilation profiles

A compilation profile is a set of options that specify the environment for a compilation output. You can specify the **addons to apply** for this profile, custom TypeScript **compiler options** for this profile, and **configuration properties** passed to any addon used in the profile.

### Define a compilation profile

You can define a compilation profile by adding a `profiles` section to the `websmith.config.json` file. The `profiles` section contains a unique profile `name` and a set of options. The `name` is used to specify the profile when calling the websmith compiler. The options are used to configure the compilation output. The options contain the following sections:

* `addons`: A list of addon names to apply for this profile
* `tsConfig`: The TypeScript compiler options for this profile
* `config`: Profile specific properties provided to profile addons
* `depends`: The list of profiles to be applied before this profile
* `esm`: Checks that the JavaScript this profile emits loads as ES modules, see [ESM check](#esm-check)

Register your addon by adding a config file `websmith.config.json` to your project folder. Add a `profiles` definition for your project with an `addons` property mentioning your addon:

```json
// ./websmith.config.json
{
    "profiles": {
        "component-docs": {
            "addons": ["component-doc-generator"],
            "config": {
                "apiCollectionPath": "./component-api-overview.yml"
            }
        }
    }
}
```

### Activate a compilation profile

You can apply a compilation profile by using the `--profile` command line parameter when calling the websmith compiler in your `package.json` build target:

```json
// ./package.json
{
    "scripts": {
        "build": "websmith --profile component-docs"
    }
}
```

### <a name="esm-check"></a>ESM check

A profile with an `esm` section gets compile-time diagnostics when its emitted JavaScript would fail to load as an
ES module, including code that addons generate. Profiles without `esm` are not checked. `esm` is not inherited
through `depends`: each profile declares its own.

```json
// ./websmith.config.json
{
    "profiles": {
        "client": {
            "addons": ["client-generator"],
            "esm": { "runtime": "node", "check": "error", "ignore": ["dist/legacy/*.cjs"] },
            "tsConfig": { "module": "ESNext", "outDir": "./dist" }
        }
    }
}
```

* `runtime` (required): The runtime that loads the output and decides whether a file is an ES module.
  * `node`: `.mjs` is ESM and `.cjs` is CommonJS; other files follow the `"type"` of the nearest `package.json`. Without
    a `"type"`, the file is classified by its syntax, like Node does, and websmith warns (91005).
  * `bundler`: webpack's module types. `.mjs` files and `.js` files under `"type": "module"` are `javascript/esm`;
    `.cjs` files and `.js` files under `"type": "commonjs"` are `javascript/dynamic` (CommonJS, where ESM syntax fails);
    all others are `javascript/auto`, where webpack accepts `require` and `__dirname` inside ES modules.
* `check`: `error` (default) fails the build, `warn` reports warnings, `off` disables the check.
* `ignore`: Glob patterns of emitted files to skip, relative to the directory of `websmith.config.json` unless
  absolute. Supported syntax: `*` (any characters except `/`), `**` (any number of directories) and `?` (one character
  except `/`); braces and brackets match literally. `\` counts as `/`, and on Windows patterns match case-insensitively.
  `--debug` lists every skipped file.

The check parses the `.js`, `.mjs` and `.cjs` files that the CLI writes. It classifies each file by the runtime,
never by `tsConfig.module`. A profile with `esm` whose `module` is not an ES module format (e.g. `CommonJS`) is a
configuration error, also with `check: "off"`, and the check skips the profile; this holds whether the profile's
`tsConfig`, `tsconfig.json`, a dependent profile or the command line sets `module`. Only free identifiers count:
`const require = createRequire(import.meta.url)` is accepted, and so are uses that run only when a `typeof` test says
the name is defined (e.g. `typeof require !== "undefined" ? require("x") : null`).

| Code | Finding | `node` | `bundler`, `javascript/esm` | `bundler`, `javascript/auto` | `bundler`, `javascript/dynamic` |
|------|---------|--------|-----------------------------|------------------------------|---------------------------------|
| 91001 | free `require` in ESM output | error | error | allowed | allowed |
| 91002 | free `module` / `exports` in ESM output | error | error | allowed | allowed |
| 91003 | free `__dirname` / `__filename` in ESM output | error | error | allowed | allowed |
| 91004 | ESM syntax mixed with `module.exports =` / `exports.x =` | error | error | error | error |
| 91005 | no `"type"` in the nearest `package.json`, file classified by its syntax | warning | — | — | — |
| 91010 | relative import without a file extension (`./b`); add the extension: `./b.js` | error | error | allowed | allowed |
| 91011 | relative import of a directory (`./utils`); import a file inside it, e.g. `./utils/index.js` | error | error | allowed | allowed |
| 91012 | relative import that resolves to no file written by the build or on disk | error | error | error | allowed |
| 91013 | JSON import without an import attribute; add `with { type: "json" }` | error | allowed | allowed | allowed |
| 91020 | named import that the CommonJS package does not export (`import { a } from "pkg"`) | error | allowed | allowed | — |
| 91021 | default import from a CommonJS module that sets `__esModule` (`import def from "pkg"`) | error | error | allowed | — |
| 91030 | `.cjs` file with ESM syntax (`import`, `export` or `import.meta`) | error | — | — | error |
| 91031 | `.js` file with ESM syntax under `"type": "commonjs"`; names the `package.json` | error | — | — | error |
| 91032 | file loaded as ESM whose output is CommonJS: no ESM syntax, but `exports.x =`, `module.exports =` or `__esModule` | error | error | — | — |
| 91033 | top-level `await` in a file loaded as CommonJS | error | — | — | error |

91001–91004 apply to files the runtime loads as ES modules, plus 91004 in `javascript/auto` and `javascript/dynamic`
files for `bundler`. Under `node`, `.cjs` files and files under `"type": "commonjs"` load as CommonJS: 91030, 91031
and 91033 report ESM syntax and top-level `await` in them. Dynamic `import()` is valid CommonJS and never counts as
ESM syntax. When 91030, 91031 or 91032 reports a file, its 91001–91004 findings are left out: they share one cause,
a module format that contradicts how the file loads, often a `module` that emits CommonJS. The `transpileModule` fast path ignores `"type"` and can emit CommonJS into files loaded
as ESM, for example with `module: "Node16"`.

With `esm` and a `check` other than `"off"`, TypeScript diagnostics for imports and syntax that fail to load as ESM
get the label `(ESM check, profile "<name>")` appended to the printed message; code and category stay the same, and
the diagnostics in a programmatic `EmitResult` stay unlabelled. The labelled codes are TS2835 (relative
import without extension), TS2834 (directory import), TS1543 (JSON import without `with { type: "json" }`), TS1470
(`import.meta` in CommonJS output), TS1309 (top-level `await` in CommonJS output) and TS1203 (`export =` in an ES
module). TypeScript reports them only when it type checks, which is when an active addon needs type information; the
fast path and per-file declaration programs do not report them, while the ESM check of the emitted files runs on every
path. TS1479 and TS1471 (CommonJS importing an ES module) are not labelled: `require()` of ES modules works on the
supported Node versions.

91010–91013 check the relative specifiers (`./`, `../`) of static imports, re-exports and `import()` with a string
literal. `import()` with a computed specifier is skipped, and bare specifiers such as `"pkg"` are not checked. The
check sees the specifier in the emitted file, not the one in the TypeScript source. A specifier counts as
extensionless when it has no extension, or when its extension is none of `.js`, `.mjs`, `.cjs`, `.json`, `.node` and
`.wasm` and adding `.js` names an existing file (e.g. `./user.service`); any other specifier that names no file gets
91012; a JSON import with `assert` instead of `with` also gets 91013. 91012 resolves a specifier against the files the
build writes and the files on disk, so under `addonEmitOnly` a file left by an earlier build counts. In
`javascript/auto` files it also tries the extensions `.js`, `.mjs`, `.cjs` and `.json` and accepts directories, like
webpack does. On the Program path, TypeScript may report the same import on the source file as well (TS2834, TS2835,
TS1543).

91020 and 91021 check `import` and `export … from` declarations with a bare specifier (`"pkg"`, `"pkg/sub"`) that
resolves to a CommonJS entry. The package resolves the way Node's ESM loader does: `node_modules` upwards from the
emitted file, following symlinks such as pnpm's, then `package.json` `"exports"` with the conditions `node`, `import`,
`module-sync` and `default`, or without `"exports"`, `main` and `index.js`. An entry the runtime loads as ES module is
not checked. Under `bundler`, a package with a `"module"` or `"browser"` field and no `"exports"` is not checked,
because the bundler may load another entry than `main`.

The export names are those Node's `cjs-module-lexer` detects, following re-exports such as
`__exportStar(require("./inner"))`, so TypeScript-compiled packages import by name as they do under Node, while
`module.exports = Object.assign(...)` does not. websmith uses `cjs-module-lexer` 2.x; Node 22 bundles 2.1.0, and
Node 24 does not report its version, so rare differences from the runtime are possible.

A default import from a module that exports both `__esModule` and `default` is its whole `module.exports` under
Node and strict webpack, not its default export. 91021 reports it only when the default binding is used other than
through property access: called, passed as argument, spread, returned, compared or exported, and always for
`export { default } from "pkg"`. `import pkg from "pkg"; pkg.default()` and `pkg.named` are accepted.

When the check cannot decide, for example for a package that is not installed or a re-export it cannot resolve, it
reports nothing and `--debug` lists the import.

Diagnostics point at the construct in the emitted file and name the profile and its active addons, e.g.
`Error: dist/client.js (2,26): ESM91001: "require" is not defined in ES module output; ...`. The check runs in
`websmith` builds; watch mode, JavaScript written by result processors and the webpack loader are not checked yet.

## Websmith configuration file

The `websmith.config.json` file is used to configure the compilation output. It's placed in your project root and may contain the following sections:

* `addons`: A list of compiler addons
* `addonEmitOnly`: Whether to only emit files processed by active addons (boolean)
* `addonsDir`: Relative path to the directory containing the addons.
* `profiles`: A list of compilation profiles
* `transpileOnly`: Whether the compiler should emit any output.

The `profiles` section contains a record of compilation profiles. See above for more details on configuring profiles.

You can place your `websmith.config.json` file in the root of your project or use the `--configFile` parameter to specify a different path.
