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

## [0.8.0] - 2025-11-17

### Added

- 🚀 **Addon Emit Only Compilation Mode**: Added new `addonEmitOnly` compilation mode for selective file emission
  - New `--addonEmitOnly` CLI flag to only emit files processed by active addons
  - Files are marked as addon-processed when generators, processors, or transformers operate on them
  - Files can also be explicitly marked via `addInputFile()` or `addVirtualFile()` methods
  - All files are still compiled for type checking and dependency resolution, but only addon-processed files are written to disk
  - Can be combined with `transpileOnly` for fast builds without type checking
  - Perfect for code generation workflows where original source files should remain unchanged
  - Added `addonEmitOnly` option to `CompilationConfig`, `WebpackLoaderOptions`, and `CompilerArguments`
  - Implemented file tracking in `CompilationContext` with `markFileAsAddonProcessed()` and `isFileProcessedByAddon()` methods
  - Added comprehensive test coverage for CLI, webpack loader, and compiler scenarios
  - Added `selective-processor` example addon demonstrating selective file processing patterns

## [0.7.16] - 2025-09-05

### Added

- 🔒 **Runtime Configuration Validation**: Added comprehensive runtime validation for WebsmithLoaderConfig to ensure type safety when loading JSON configurations
- 🛡️ **Duck Typing for Webpack Compilation Objects**: Implemented robust duck typing validation for webpack Compilation objects to avoid instanceof issues
- 📊 **Enhanced Error Classification**: Added specific error handling for different failure types in config file operations

### Fixed

- 🐛 **Critical Webpack Plugin Error**: Fixed an issue where `HookWebpackError: The 'compilation' argument must be an instance of Compilation` was preventing webpack builds

## [0.7.15] - 2025-08-20

This release represents a significant improvement in both performance and reliability, especially for CI environments where the race condition was most problematic.

### Added

- 🚀 **File Modification Time Caching**: Added intelligent caching for file modification times to avoid repeated filesystem operations
  - Cache entries are valid for 1 second to balance performance with accuracy
  - Significantly reduces I/O overhead during addon compilation, especially in CI environments
  - Cache is properly invalidated during configuration changes and refreshes
- 🎯 **Selective Cache Invalidation**: Implemented smart cache invalidation strategy for addon lookup cache
  - Only clears cache entries for addons that are no longer requested or available
  - Preserves cache entries for addons that are still needed, maintaining performance benefits
  - Prevents cache clearing on every `loadAddonsSync()` call, preserving performance gains
- 🔍 **Enhanced Error Messages with Context**: Added comprehensive error reporting with detailed context information
  - Error messages now include the list of files being compiled when TypeScript program creation fails
  - File-specific context in diagnostic messages with relative paths for better readability
  - Improved debugging capabilities for addon compilation issues
- 📊 **Comprehensive Diagnostic Reporting**: Implemented complete TypeScript diagnostic reporting for addon compilation
  - **Errors** are reported as `ErrorMessage` with full context
  - **Warnings** are reported as `WarnMessage` instead of being silently discarded
  - **Info/Suggestions** are reported as `InfoMessage` for complete developer feedback
  - All diagnostics include file names and detailed TypeScript compiler messages

### Fixed

- 🐛 **Cross-Addon Dependency Compilation**: Fixed critical race condition in CI environments where addons with cross-dependencies failed to compile
- 🐛 **Addon Lookup Cache Stale References**: Fixed issue where addon lookup cache was never cleared during registry refresh
- 🐛 **Inefficient Map Iteration**: Optimized addon lookup by replacing `Array.from(Map.values()).find()` with direct Map iteration
- 🐛 **Fallback Compilation Cache Bypass**: Fixed issue where fallback compilation processed all files regardless of

## [0.7.14] - 2025-01-27

This release significantly enhances webpack integration with full support for generator addons, improved rootDir inference, and comprehensive webpack asset manipulation capabilities. The main improvements include complete generator addon support in webpack builds, automatic rootDir detection from tsconfig.json, and enhanced webpack compilation context handling.

### Added

- 🚀 **Full Generator Addon Support in Webpack**: Added complete support for generator addons in webpack builds
  - Generator addons can now manipulate webpack assets and dependencies during compilation
  - Added support for `addInputFile`, `addVirtualFile`, `addAssetDependency`, and `removeOutputFile` operations
  - Generator output is properly integrated into webpack's asset emission system
  - Enhanced WebpackAddonContext with comprehensive asset and dependency management
- 🧪 **Enhanced Test Coverage for Webpack Integration**: Added comprehensive E2E tests for generator addons with debug logging
  - Tests ensure generated output is created and properly reported in logs
  - Improved test coverage for webpack asset manipulation scenarios
- 🔧 **Automatic rootDir Inference**: Added intelligent rootDir inference from tsconfig.json location in webpack compilation context
  - Uses tsconfig.json file location and include patterns to automatically determine appropriate rootDir
  - Eliminates manual rootDir configuration requirements for complex project setups
  - Enhanced path resolution for better cross-platform compatibility

### Fixed

- 🐛 **Webpack Unknown Addon Reporting**: Fixed issue where webpack did not report unknown addons in websmith.config.json profiles
  - Enhanced error reporting for invalid addon configurations in webpack context
  - Improved validation and user feedback for addon configuration issues
- 🐛 **Addon Cache Directory Creation**: Fixed unnecessary creation of `.websmith-cache/addons` directory when no addons need compilation
  - Optimized addon compilation workflow to only create cache directories when needed
  - Reduced filesystem clutter in projects without compiled addons
- 🐛 **Complex Setup rootDir Issues**: Fixed rootDir resolution problems in more complex project setups
  - Enhanced path resolution logic for nested project structures
  - Improved handling of monorepo and multi-package project configurations
- 🐛 **Test Environment Assumptions**: Fixed test assumptions and improved test reliability
  - Enhanced test isolation and setup consistency
  - Fixed flaky tests related to webpack compilation context

### Changed

- 🔧 **Enhanced Webpack Asset Handling**: Significantly improved webpack asset and dependency manipulation capabilities
  - Enhanced WebpackAddonContext with 244+ lines of new functionality for asset management
  - Improved WebpackAddonService with 93+ lines of enhanced addon compilation logic
  - Expanded result-handling.ts with 523+ lines of comprehensive asset processing
- 🔧 **Improved Webpack Integration Testing**: Enhanced webpack test suite with comprehensive coverage
  - Added 794+ lines of enhanced webpack integration tests
  - Improved test scenarios for complex webpack configurations and addon interactions
  - Enhanced debugging and logging capabilities for webpack compilation issues

## [0.7.13] - 2025-01-26

This release focuses on improving TypeScript declaration file emission, enhancing addon compilation infrastructure, and upgrading dependencies. The main improvements include fixing .d.ts and .d.ts.map file emission in webpack loader, better addon compilation path handling, and comprehensive Jest dependency upgrades.

### Added

- 🚀 **Enhanced Declaration File Support**: Added proper .d.ts and .d.ts.map file emission support in websmith-loader
  - Declaration files are now correctly emitted as webpack assets when `declaration: true` and `declarationMap: true` are set in tsconfig
  - Files are emitted with proper filename extraction for webpack asset naming
  - Supports both declaration files (.d.ts) and declaration maps (.d.ts.map)
- 🧪 **Improved Addon Compilation Infrastructure**: Enhanced addon compilation from source with better lib folder handling
  - Addons are now compiled into a lib folder next to src for better organization
  - Enhanced path handling for addon compilation across different environments
  - Better support for pre-built vs. source-based addon loading
- 🧪 **Enhanced Test Infrastructure**: Added additional unit tests to ensure all CLI flags are passed correctly to the compiler

### Removed

- 🧹 **Configuration Cleanup**: Removed warnings for non-addon folders within the addonsDir to reduce noise

### Changed

- 🔧 **Message Category Handling**: Restructured diagnostic message handling to ensure proper categorization
  - InfoMessages now properly display as message category instead of generic info
  - Enhanced ErrorMessage and WarnMessage handling for better error reporting consistency
  - Improved diagnostic message formatting and display in compiler output
- 🔧 **Dependency Upgrades**: Upgraded Jest and related testing dependencies across all packages
  - Updated Jest to version ^29.7.0 for better testing performance and compatibility
  - Updated @types/jest to ^29.5.14 for improved TypeScript support
  - Updated ts-jest to ^29.2.5 for better TypeScript integration in tests
  - Upgraded peer dependency requirements for Jest to 29.x for consistency
- 🔧 **Language Service Integration**: Improved language service integration with addon application
  - Enhanced addon application process for better IDE support
  - Fixed integration issues between language service and addon functionality

### Fixed

- 🐛 **Declaration File Emission**: Fixed critical issue where .d.ts and .d.ts.map files were not emitted to disk with tsconfig options `declaration` and `declarationMap` set to true
  - Webpack loader now properly processes and emits TypeScript declaration files
  - Fixed file emission logic to handle both declaration files and source maps correctly
  - Ensured proper integration with webpack's asset emission system
- 🐛 **Addon Compilation Path Handling**: Fixed issue with addon compilation path handling in different environments
  - Improved path resolution for addon source files and compiled output
  - Fixed compilation issues when addons are loaded from different directory structures
  - Enhanced error handling for addon compilation failures
- 🐛 **Language Service Addon Integration**: Fixed issue with the language service and addon application
  - Resolved integration problems between TypeScript language service and addon functionality
  - Improved addon activation process in language service context
- 🐛 **Non-Addon Folder Warnings**: Fixed issue where warnings were issued for non-addon folders within the addonsDir
  - Eliminated false positive warnings for shared folders and non-addon directories
  - Improved addon discovery logic to properly identify actual addon folders

## [0.7.12] - 2025-08-10

This release focuses on improving error handling reliability. The main improvements include removing unnecessary testing dependencies from production packages and implementing comprehensive error reporting for addon failures.

### Added

- 🧪 **Enhanced Error Reporting for Addons**: Added comprehensive error handling and reporting for all addon lifecycle stages
  - Generator errors are now caught and reported with detailed error messages while allowing compilation to continue
  - Processor errors are caught and reported, with processing chain stopping on the first error
  - Result processor errors are caught and reported without stopping the overall compilation
  - Transformer errors during transpilation are caught and reported with graceful fallback
  - Addon activation errors are caught and reported with proper error context
  - All error messages include the addon name and specific error details for better debugging
- 🧪 **Improved Test Infrastructure**: Enhanced test reliability with better mock implementations and system setup
  - Added proper stdout mocking in bin.spec.ts to prevent unwanted console output during tests
  - Replaced `compileSystem` with `createSystem` for more consistent virtual file system testing
  - Enhanced AddonRegistry test setup with proper system and reporter configuration

### Removed

- 🧹 **Testing Dependencies Cleanup**: Removed unnecessary `@quatico/websmith-testing` dependency from production packages
  - Removed testing dependency from `@quatico/websmith-compiler` package
  - Removed testing dependency from `websmith-loader` package
  - Cleaned up Jest configuration to remove unused module name mappings
  - Reduced package size and eliminated circular dependencies between testing and production code

### Changed

- 🔧 **Error Handling Architecture**: Improved addon error handling throughout the compilation pipeline
  - Enhanced CompilationContext to track addon function ownership for better error reporting
  - Added comprehensive try-catch blocks around all addon execution points
  - Improved error recovery mechanisms to allow compilation to continue after addon failures

### Fixed

- 🐛 **Addon Error Recovery**: Fixed compilation failures when addons throw errors during execution
  - Addon activation errors no longer crash the compiler
  - Generator errors are isolated and don't prevent other generators from running
  - Processor errors stop the processing chain for that file but don't crash the compilation
  - Result processor errors are isolated and don't prevent compilation completion
  - Transformer errors during transpilation are caught with proper fallback handling

## [0.7.11] - 2025-08-08

This release significantly enhances the CLI's file handling capabilities and ensures complete tsconfig compliance. The websmith CLI now properly respects TypeScript configuration patterns and provides comprehensive support for explicit file arguments.

### Added

- 🚀 **Complete CLI File Argument Support**: Added full support for explicit file arguments that override tsconfig file discovery
  - CLI commands like `websmith file1.ts file2.ts --project tsconfig.json` now work as expected
  - Explicit files completely override tsconfig include/exclude patterns while preserving all compiler options
- 🧪 **Comprehensive File Discovery Tests**: Added 6 new test cases covering all file discovery scenarios
  - Tests for tsconfig include patterns (`include: ["src/**/*"]`)
  - Tests for custom include patterns (`include: ["src/custom/**/*.ts"]`)
  - Tests for explicit file arguments overriding tsconfig discovery
  - Tests for exclude patterns (`exclude: ["src/excluded/**"]`)
  - Tests for CLI file arguments with exclude patterns
  - Tests for tsconfig options preservation in all scenarios
- 🔧 **Enhanced Test Infrastructure**: Added automatic subdirectory creation for nested file structures in tests
- 🔧 **Improved Path Handling**: Enhanced argument parsing to support file paths with various extensions (.ts, .tsx, .js, .jsx)

### Fixed

- 🐛 **tsconfig Include/Exclude Pattern Compliance**: Fixed file discovery to properly respect tsconfig include and exclude patterns
  - Replaced manual file discovery (`recursiveFindByFilter`) with TypeScript's built-in `parsedCommandLine` for proper pattern matching
  - Files are now correctly discovered based on tsconfig configuration rules
- 🐛 **CLI File Argument Processing**: Fixed explicit file arguments being ignored by the compiler
  - Added proper extraction and processing of file arguments from command line
  - Enhanced `command.ts` to detect and handle file arguments separately from option arguments
  - Modified `parsedCommandLine` to accept and process explicit file arguments correctly
- 🐛 **tsconfig Options Preservation**: Fixed missing tsconfig properties in `cliArgs.options`
  - Ensured all configured tsconfig properties are included in `compiler.getContext().getCliArgs().options`
  - Fixed option merging logic in `ResolvedCompilerOptions` to preserve all tsconfig settings
  - Maintained proper option precedence: CLI options > tsconfig options > defaults
- 🐛 **Array Merging Logic**: Fixed array merging issue where CLI files were being merged with tsconfig files instead of replacing them
  - Implemented proper replacement logic when explicit files are provided
  - Prevented unwanted file contamination from tsconfig discovery when using explicit arguments

### Changed

- 🔧 **File Discovery Architecture**: Replaced manual file discovery with TypeScript's native configuration parsing
  - Enhanced `parsedCommandLine` function to handle both tsconfig-based and explicit file discovery
  - Improved integration between CLI argument parsing and TypeScript configuration resolution
- 🔧 **Test Isolation**: Enhanced test reliability with unique test directories for each test run
  - Added `getTestDirs()` helper function for consistent test directory management
  - Improved cross-platform compatibility with better path handling
- 🔧 **Configuration Flow**: Streamlined the flow from CLI arguments through configuration resolution to final compiler options
  - Better separation of concerns between file discovery and option processing
  - Enhanced error handling and validation for file arguments

## [0.7.10] - 2025-08-08

This release significantly improves the reliability and functionality of addon loading and configuration handling, particularly for profile-based configurations and file-based config scenarios.

### Added

- 🧪 **Enhanced Test Isolation**: Added unique test directory generation (`getTestDirs()`) to prevent test contamination and improve reliability
- 🔧 **Dynamic AddonRegistry Configuration**: Added automatic configuration updates for AddonRegistry when compiler options are resolved
- 🧪 **Improved Test Coverage**: Enhanced test reliability by fixing 5 out of 6 major test failures in the compiler test suite

### Fixed

- 🐛 **Profile-Based Addon Loading**: Fixed critical issue where addons were not being loaded when using profile-based configuration files
  - Fixed path resolution for addons directory in config files by using relative paths instead of absolute paths
  - Fixed AddonRegistry creation logic to handle config file scenarios properly
- 🐛 **Configuration Resolution**: Fixed AddonRegistry not being updated with resolved configuration after ResolvedCompilerOptions processing
  - Added automatic configuration update in `Compiler.setOptions()` method
  - Ensured addons directory and addon lists are properly resolved from config files
- 🐛 **YAML Generator Addon**: Fixed `export-yaml-generator` addon not generating `output.yaml` files in profile-based tests
- 🐛 **Transformer Application**: Fixed `foobar-replace-transformer` addon not being applied during TypeScript compilation in profile-based scenarios
- 🐛 **Addon Compilation**: Fixed infinite loop issues in addon compilation from source by switching from full `Compiler` class to `ts.transpileModule` for individual file transpilation
- 🐛 **Test Suite Reliability**: Improved test suite success rate from 70% to 95% (19 out of 20 tests now passing)

### Changed

- 🔧 **Addon Loading Logic**: Modified addon creation condition in `compile()` function to include config file scenarios
- 🔧 **Path Resolution**: Updated profile-based tests to use relative paths for better cross-platform compatibility
- 🔧 **Configuration Flow**: Enhanced configuration resolution flow to properly handle both inline and file-based addon configurations

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
