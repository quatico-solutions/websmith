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

## Websmith configuration file

The `websmith.config.json` file is used to configure the compilation output. It's placed in your project root and may contain the following sections:

* `addons`: A list of compiler addons
* `addonEmitOnly`: Whether to only emit files processed by active addons (boolean)
* `addonsDir`: Relative path to the directory containing the addons.
* `profiles`: A list of compilation profiles
* `transpileOnly`: Whether the compiler should emit any output.

The `profiles` section contains a record of compilation profiles. See above for more details on configuring profiles.

You can place your `websmith.config.json` file in the root of your project or use the `--configFile` parameter to specify a different path.
