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
-

## [0.3.5] - 2023-02-1

With this version, the usage of the BrowserSystem (createBrowserSystem) is deprecated. It is planned to remove it with version 0.4.0 which will cease support for a system based virtual filesystem.

### Changed

- Mono repository internal dependency now use single pinned versions.

### Bugfix

- Removal of custom ts.CompilerHost to address compile error logging regarding typescript lib.d.ts files and resulting type resolution lookups.

## [0.3.4] - 2022-11-24

### Fixes

- No longer collect preEmitDiagnostics with transpileOnly active

## [0.3.3] - 2022-11-18

### Fixes

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
