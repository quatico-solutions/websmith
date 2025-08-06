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

- TBA
  
### Removed

- TBA

### Changed

- TBA

### Fixed

- TBA

## [0.7.9] - 2025-08-06

This release focuses on improving test data management, configuration handling, and error reporting. The main improvements include standardized test output directories, better configuration validation, and enhanced error messages for addon compilation.

### Added

- 🧪 **Standardized Test Data Management**: Added consistent `test-output` directory usage across all packages for test artifacts
- 🧪 **Enhanced Test Reliability**: Added increased Jest test timeouts (60 seconds) to prevent flaky tests in CI environments
- 🧪 **Test Configuration Consistency**: Added consistent TypeScript `moduleResolution: Node10` configuration across all test setups

### Removed

- 🧹 **Code Cleanup**: Removed unused addon-resolver functionality (`addon-resolver.ts` and related exports)
- 🧹 **Default Path Removal**: Removed default paths for `configFile` and `addonsDir` to eliminate unnecessary warnings
- 🧹 **Compiler Options Cleanup**: Removed `addons`, `addonsDir`, and `projectDir` from ResolvedCompilerOptions for better encapsulation

### Changed

- 🔧 **Test Infrastructure**: Separated test-output directories for individual tests and re-enabled parallel test execution
- 🔧 **Configuration Handling**: Refactored AddonConfig to support optional `addonsDir` values
- 🔧 **Test Setup Alignment**: Aligned test setups for compiler unit and e2e tests for consistency
- 🔧 **Webpack Loader Context**: Ensured proper loader context updates for websmith-loader
- 🔧 **Test Execution**: Configured compiler tests to run sequentially when needed to avoid resource conflicts

### Fixed

- 🐛 **Configuration Warnings**: Fixed issue where warnings were shown for non-existing `configFile` or `addonsDir` even when not specified
- 🐛 **Error Reporting**: Improved error reporting for in-place addon compilation with better diagnostic messages
- 🐛 **Path Resolution**: Enhanced diagnostic messages by wrapping file paths in quotes for better clarity

## [0.7.8] - 2025-08-04

### Added

- 🔧 **Configuration Support**: Added support for "profiles" configuration option in ResolvedCompilerOptions
- 🧪 **Comprehensive Test Suite**: Added extensive test coverage for CLI arguments, compiler configurations, and webpack loader functionality
- 🧪 **Enhanced Test Infrastructure**: Added sophisticated test coverage for AddonRegistry, Compiler, and configuration handling
- 🧪 **NoReporter for Tests**: Added NoReporter utility for cleaner test console output when testing invalid configurations

### Removed

- 🧹 **Code Cleanup**: Removed jest.clearAllMocks() statements (now handled through jest configuration)
- 🧹 **Duplicate Parameters**: Removed duplicated reporter parameter from Compiler
- 🧹 **Profile Wildcards**: Replaced profile "*" with undefined for better type safety

### Changed

- 🔧 **Test System Architecture**: Moved compile-system from core package into testing package for better separation of concerns
- 🔧 **Testing Utilities**: Replaced testing/compileSystem with createSystem in core package for improved testing workflow
- 🔧 **TypeScript Defaults**: Created single abstraction for TS_DEFAULTS and aligned defaults with actual TSC defaults
- 🔧 **API Requirements**: Loosened API requirements for better flexibility
- 🔧 **Compiler Structure**: Restructured Compiler class by sorting members by visibility
- 🔧 **Configuration Handling**: Improved addon handling in configuration and removed Partial from config options
- 🧪 **Test Coverage**: Provided comprehensive test coverage for tsc CLI arguments and websmith-specific arguments
- 🧪 **Test Setup**: Improved test configurations, webpack configuration tests, and console output during tests

### Fixed

- 🐛 **Error Reporting**: Improved error reporting when compiling invalid addon code
- 🐛 **Linting Issues**: Fixed various linting issues across the codebase
- 🐛 **Test Configuration**: Fixed test timeout and configuration precedence issues (buildDir vs. tsConfigFile vs configFile)
- 🐛 **Jest Configuration**: Removed illegal jest configuration properties and improved test setup

## [0.7.7] - 2025-07-29

### Added

- ✨ **Enhanced Debug Logging**: Added comprehensive debug logging system with `--debug` flag support
- 🔧 **Webpack Loader Integration**: Enhanced websmith-loader with webpack infrastructure logging
  - Debug logs now appear in webpack stats output with `[websmith-loader]` prefix
  - Integration with webpack's `infrastructureLogging` system
  - Support for different webpack stats configurations
  - Proper fallback to console.log when webpack logger is unavailable
  - Comprehensive e2e tests for webpack stats logging functionality

### Fixed

- � Fixed debug logs not appearing in webpack stats output
- 🐛 Fixed loader context integration for proper webpack logging
- 🐛 Fixed infrastructure logging configuration for websmith-loader

## [0.7.6] - 2025-01-23

This release improves the websmith CLI help system and implements dynamic version handling to maintain consistency with package.json.

### Added

- ✨ Added dynamic version reading from package.json at runtime to ensure CLI version always matches package version
- 📚 Added proper help message display for `websmith --help` command with complete option listing

### Changed

- 🔧 Refactored version reading logic into separate `get-version` module for better maintainability

### Fixed

- 🐛 Fixed websmith CLI help command not displaying properly due to custom option conflicts
- 🐛 Fixed lib folder structure where package.json was incorrectly copied during TypeScript compilation

## [0.7.5] - 2025-07-23

This release improves the websmith CLI by aligning the behavior with the tsc compiler.

### Fixed

- 🐛 Fixed an issue where the websmith CLI with --configFile and unknown file path does not report failure
- 🐛 Fixed an issue where the websmith CLI with --addonsDir and unknown path does not report failure
- 🐛 Fixed an issue where the websmith-loader does not apply the tsConfigFile property to the compiler options

## [0.7.4] - 2025-07-21

This release fixes issues where properties from ts.CompilerOptions were not correctly applied to the compiler options. It also improves test coverage and dependency management.

### Added

- Added comprehensive test cases for bin.ts in packages/compiler/src/bin.spec.ts, including scenarios for handling arguments, command parsing, and error handling. This ensures robust test coverage for the CLI functionality.
- Enhanced compile-websmith.test.ts in packages/compiler-test/tests with additional test cases to validate various tsconfig and websmith configurations, including overrides and profiles.
  
### Removed

- Removed ts-node as a dependency from package.json files in packages/compiler-test and packages/compiler, likely due to its redundancy or replacement.

### Changed

- Updated the @types/node dependency version to 20.19.9 across multiple package.json files for consistency.

### Fixed

- Fixed an issue where properties from ts.CompilerOptions were not correctly applied to the compiler options.

## [0.7.3] - 2025-04-04

### Fixed

- 🐛 Fixed an issue where websmith CLI with --configFile and unknown file path does not report failure <https://github.com/quatico-solutions/websmith/issues/66>
- 🐛 Fixed an issue where websmith CLI with --addonsDir and unknown path does not report failure <https://github.com/quatico-solutions/websmith/issues/59>

### Changed

- 🔧 Removes unused memfs dependencies and mocks from tests

## [0.7.2] - 2025-03-27

### Fixed

- 🐛 Fixed an issue with package exports in `@quatico/websmith-core`

## [0.7.1] - 2025-03-27

### Fixed

- 🐛 Fixed source links in markdown documentation files
- 🐛 Fixed links and cross-anchors in markdown documentation files

## [0.7.0] - 2025-03-26

Compilation Profiles are here. This release replaces compiler targets with compilation profiles. Choose a single profile to customize the compilation output with individual compiler options, different outDir and addons selection. A compilation profile can depend on other profiles. Dependent profiles contribute addons and compiler options, which are applied in the order of the dependency chain. With the introduction of profiles, we've aligned how compiler options are composed. The websmith CLI becomes a drop-in replacement for the `tsc` command and the `websmith-loader` a drop-in replacement for the `ts-loader`.

### Added

- 🚀 Added new library package `@quatico/websmith-node` for running websmith in Node.JS as compiler and with webpack
- 🚀 Added JIT compilation of websmith addons from TypeScript source
- 🚀 Added test coverage for example addons
- 🚀 Added webpack-loader fixes for compiler instance cache

### Removed

- 🔧 Removed buildDir from compilation context
- 🔧 Removed artificial default values for compiler options in CLI, webpack loader and testing environment

### Changed

- 🔥 Renamed package `@quatico/websmith-webpack` to `websmith-loader`
- 🔥 Renamed private package `example-addons` to published package `@quatico/websmith-examples`
- 🔥 Renamed package `test` to `compiler-test`
- 🔥 Renamed configuration properties to achieve better consistent naming across all packages
  - "project" → "tsConfigFile"
  - "target" → "profile"
  - "targets" → "profiles"
  - "TargetConfig" → "CompilationProfile"
- 🔧 Moved `compileSystem` into package `core` to be used in production code
- 🔧 Encapsulated compiler state for Compiler and TsCompiler with separated ResolvedCompilerOptions as abstraction
- 🔧 Unified path resolution for all paths in tsConfig, config, and cliArgs
- 🔧 Inlined LanguageHost and CompilationHost into CompilationContext
- 🔧 Aligned all CLI arguments with the tsc compiler, added missing options
- 🔨 Upgraded project dependencies to eslint9 flat config
- 🔨 Added eslint-plugin-unicorn for better node imports linting
- 🔨 Enforced prefix 'node:' to all node library imports
- 🔨 Upgraded project dependencies and introduced project-based jest configuration
- 🔨 Replaced @swc/jest with consistent ts-jest configuration
- 📚 Improved overall documentation with better wording in README files of all packages
- 📚 Enhanced documentation for core webpack and testing packages
- 📚 Provided more sophisticated documentation for compiler command and CLI parameters
- 📚 Provided documentation for Addon API with better overview in API package
- 📚 Improved main README file for better overview
- 🧪 Improved E2E test fixture for websmith-loader to test multiple and chained entries

### Fixed

- 🐛 Fixed an issue with webpack tests with multiple and chained entries
- 🐛 Fixed an issue with eslint-plugin-unicorn rules with node import issues
- 🐛 Fixed various issues with resolved options and hidden error logs
- 🐛 Fixed typing issues with with comment-json for parsing
- 🧪 Fixed an issue with testTimeout in github pipelines for various test suites to pass
- 🧪 Fixed an issue with reported compilation diagnostics in E2E and integration tests

## [0.6.3] - 2025-01-23

Compilation with selected addons but no targets does not apply addons to emitted output. This release fixes the issue and improves the lifecycle of the AddonRegistry.

### Fixed

- Fixes Issue 51 Compilation with selected addons but no targets does not apply addons to emitted output.

## [0.6.3] - 2025-01-22

Bugfix release to address an issue with the compiler does not transpile any output when no target is specified

### Fixed

- Fixes Issue 49 Running the compiler w/ available 'addons' but w/o 'target' does not transpile any output"

### Changed

- Improves lifecycle of AddonRegistry. No need to call `refresh()` from AddonRegistry instantiation

## [0.6.1] - 2025-01-20

Bugfix release to address an issue with the webpack loader configuration and the websmith options to activate an addon.

### Fixed

- Fixes Issue 45 "Webpack loader requires 'addons' property in loader config and websmith options to activate an addon

### Changed

- Method calls for retrieving addons need to include a target parameter (e.g., getAvailableAddons())
- Refining the logic for handling targets, compilationConfig and loaderOptions in webpack override properties from config files.

### Added

- Adding documentation comments to explain the use of configuration options

## [0.6.0] - 2024-05-13

New package `@quatico/websmith-testing` for testing compiler customization and addons with Jest. The package simplifies compiler testing significantly. You can setup the typescript compiler, customize settings, add addons, and compile various projects within 5 lines of code.

### Added

- Adds new package `@quatico/websmith-testing` for testing the websmith compiler
- Provides tests for example addons using the new testing package
- Adds README.md for the new testing API package
- Provides watch mode for Browser FS with watchDirectory and watchFile capabilities

### Changed

- Upgrades all package dependencies to the latest versions
- Replaces BDD tests with E2E Addon example tests

### Fixed

- Fixes an issue where projects from custom source paths are copied into a separate directory in the buildDir
- Fixes skipped tests

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
- README.md of core package to clarify the purpose of the package.

### Added

- README.md of examples package to provide an overview of working examples on how to write websmith addons for different use cases.

## [0.3.5] - 2023-02-1

With this version, the usage of the BrowserSystem is deprecated. It is planned to remove it with version 1.0.0 which will cease support for a system based virtual filesystem.

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
