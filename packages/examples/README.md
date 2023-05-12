# websmith-examples

A set of example addons to create your own `Generators`, `Processors` or `ResultProcessors` via the [@quatico/websmith-api](https://github.com/quatico-solutions/websmith/tree/develop/packages/api/README.md) to customize the compilation process.

## Example Generator

The `example-generator` addon is a generator that creates additional input files for the compilation. It creates an additional source file for every input file with substring "foo" in its file name. The additional file is named "*-added.ts" and contains the original file content. It is compiled with the same options as the original file.

See example code in [example-generator/addon.ts](https://github.com/quatico-solutions/websmith/tree/develop/packages/examples/addons/example-generator/addon.ts) for more details.

## Example Processor

The `example-processor` addon is a processor that modifies all exports of ES modules. It finds all non exported "foobar" functions and adds an export modifier to the function declaration.

See example code in [example-processor/addon.ts](https://github.com/quatico-solutions/websmith/tree/develop/packages/examples/addons/example-processor/addon.ts) for more details.

## Example ResultProcessor

The `example-result-processor` addon is a result processor that creates JSON data with all found function names. It consumes all processed source files to find function declarations and arrow functions to extract their names into a JSON file.

See example code in [example-result-processor/addon.ts](https://github.com/quatico-solutions/websmith/tree/develop/packages/examples/addons/example-result-processor/addon.ts) for more details.

## Example Transformer

The `example-transformer` addon is a transformer that modifies the source code inside a module. It finds all "foobar" identifiers in the source file and replaces them with the string "barfoo".

See example code in [example-transformer/addon.ts](https://github.com/quatico-solutions/websmith/tree/develop/packages/examples/addons/example-transformer/addon.ts) for more details.

## Example YAML Generator

The `export-yaml-generator` is a generator that creates an additional YAML file describing all exported members per module. It creates an additional documentation file as compilation result for all files. It uses a TypeScript custom transformer to collect exported members per module.

See example code in [export-yaml-generator/addon.ts](https://github.com/quatico-solutions/websmith/tree/develop/packages/examples/addons/export-yaml-generator/addon.ts) for more details.

## Foobar Replace Processor vs. Transformer

We demonstrate the differences between Processors and Transformer in  `foobar-replace-processor` and `foobar-replace-transformer`. The Former creates a processor that uses a TypeScript transformer to replace every found "foobar" identifier with "barfoo". The Latter creates a transformer that replaces every "foobar" identifier with "barfoo".

See example code in [foobar-replace-processor/addon.ts](https://github.com/quatico-solutions/websmith/tree/develop/packages/examples/addons/foobar-replace-processor/addon.ts) and [foobar-replace-transformer/addon.ts](https://github.com/quatico-solutions/websmith/tree/develop/packages/examples/addons/foobar-replace-transformer/addon.ts) for more details.
