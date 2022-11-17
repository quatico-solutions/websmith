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

### Added

- Asset dependencies can now be registered through AddonContext using addAssetDependency.
- Support transpile only in webpack and cli, speeding up compile and watch by a factor of 20.

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
