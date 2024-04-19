<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->
<!-- markdownlint-disable MD024 -->

# Releases

Release notes follow the [keep a changelog](https://keepachangelog.com/en/1.0.0/) format.

## [Unreleased]

### Changed

- TBA

## [0.5.3] - 2024-04-19

Bugfix release to address an issue with missing compiler executable.

### Fixed

- Fixes npm package `bin` entry for the compiler executable

## [0.5.2] - 2024-04-19

Bugfix release to address an issue with workspace internal dependencies with publishing npm packages.

### Fixed

- Fixes an issue with unresolved `workspace:` dependencies in published packages

## [0.5.1] - 2024-04-18

Bugfix release to address an issue with publishing the npm packages.

### Fixed

- Fixes an issue with the `publish-npm` target for github release pipeline

## [0.5.0] - 2024-04-18

In this version, we've migrated the project from yarn to pnpm to improve the dependency management and build process. We've also updated the dependencies to the latest versions, including eslint and typescript.

### Fixed

- Fixes an CLI issue with duplicated shorthand parameter. The transpileOnly flag is now set to '-o'.
- Fixes a documentation issue with a broken link in the README of `@quatico/websmith-api`.

### Changed

- Upgrades build environment for development and pipelines to node 20 with pnpm
- Introduces new E2E testing package for webpack tests `@quatico/websmith-webpack-test`
- Upgrades eslint to version 9 and flat config, updates Idea and VSCode settings for eslint and prettier
- Upgrades all package dependencies

## [0.4.2]  - 2023-08-11

### Changed

- Major version upgrade of all package dependencies.
- Replace dependency on `typescript` with peer dependency.
- Unifies build commands across packages.

## [0.4.1] - 2023-06-16

In this version, we've improved the dependencies and build process of all packages. We updated the defaults to use EsNext modules by default. We also improved the test setup and execution.

### Changed

- Target "watch:test" now runs tests in watch mode.
- Change defaults of websmith to use ESNext modules by default.
- jest runs tests without verbose output.

### Removed

- Removes paths configs from tsconfig.json of all packages.

## [0.4.0] - 2023-05-12

In this version, we've improved the documentation of published packages. Most importantly we ship an overview of working examples on how to write websmith addons for different use cases.

### Changed

- README.md of compiler package to improve compiler usage documentation.
- README.md of api package to introduction to websmith api.
- README.md of webpack package to improve webpack usage documentation.
- README.md of core package to clearify the purpose of the package.

### Added

- README.md of examples package to provide an overview of working examples on how to write websmith addons for different use cases.

## [0.3.5] - 2023-02-1

With this version, the usage of the BrowserSystem (createBrowserSystem) is deprecated. It is planned to remove it with version 1.0.0 which will cease support for a system based virtual filesystem.

### Changed

- Mono repository internal dependency now use single pinned versions.

### Fixed

- Removal of custom ts.CompilerHost to address compile error logging regarding typescript lib.d.ts files and resulting type resolution lookups.

## [0.3.4] - 2022-11-24

### Fixed

- No longer collect preEmitDiagnostics with transpileOnly active

## [0.3.3] - 2022-11-18

### Fixed

- @quatico/websmith-core is public again and no longer bundled due to yarn 1.x inability to install bundled dependencies correctly.

## [0.3.1] - 2022-11-18

### Fixed

- Corrects bundling of websmith-core in websmith-compiler and websmith-webpack.
- Webpack module correctly processes webpack config options.

## [0.3.0] - 2022-11-17

### Added

- Asset dependencies can now be registered through AddonContext using addAssetDependency.
- Support transpile only in webpack and cli, speeding up compile and watch by a factor of 20.

### Changed

- The package @quatico/websmith-cli is now @quatico/websmith-compiler.
- The original @quatico/websmith-compiler dependency is now bundled.
- Expose API required for custom implementations through @quatico/websmith-compiler and @quatico/websmith-webpack.
- Upgrade Module loader implementation to Webpack 5.

### Fixed

- Upgrade Module loader implementation to Webpack 5.

## [0.2.0] - 2022-07-07

### Added

- Support for thread-loader and fork-ts-checker-webpack-plugin

## [0.1.0] - 2022-05-27

### Added

- Addon based processing pipeline with Generator, Processor, Transformer and Result Processor stages.
- ClI package for running the compiler of configurable CLI.
- Webpack plugin for running the compiler as part of a webpack build.
- Documentation: New 'Getting started' and 'Writing your own addons' documentation added
