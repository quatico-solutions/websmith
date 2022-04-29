
# Language

## Compiler Terminology

* **Project**: A typescript environment.
* **Project Configuration**: A set of parameters to configure the `Project`
* **Compiler Configuration**: A set of parameters to configure the `Compiler`, e.g. activated `Compilation Options`, `Addons`, `Target` etc.
* **Configuration File**: A file that defines a set of options.
* **Compiler**: A program that receives a number of source files, a configuration and (optionally) a target, and then performs a `Compilation` per file.
* **Compiler Options**: A resolved and merged truth from `CLI Arguments`, `Project Configuration` and `Compiler Configuration` to control the `Compilation` process.
* **Compilation**: The process of transforming and transpiling a single source file to a collection of outputs.
* **Compilation Context**: A context in which a `Compilation` for a `Target` is executed with `Compiler Options` and `Target Options`.
* **Compilation Host**: A ts.LanguageServiceHost abstraction allowing the `Compilation Context` to control the `Compilation` process per `Compilation Target`.
* **Compilation Target**: An optional argument that controls the applied `Addons` and used configuration to the `Compilation` process.
* **Compilation Options**: A set of parameters that controls a `Compilation Target`
* **Target Options**: A set of parameters specific to a `Compilation Target` that are part of the `Compilation Options` and that are available to addons of a `Compilation Target`.

## Addon Terminology

* **Addon Registry**: A repository containing the set of available `Addons` and an optionally defined map of `Compilation Target` to `Addons`
* **Addon**: Is an addition to the `Compilation` process that applies its transformer(s) based on a compilation target.
* **Addon registration**: Resolves the ES module and makes it available to the `Addon Registry`.
* **Addon activation**: Selects an `Addon` to be added to a `Compilation Context` to be applied to its `Compilation`
* **Addon Activator**: A function that registers the `Addon` module to the `Addon Registry` with its name.
* **Generator** Is a source code procession that receives a source file name and content and generates additional information based on the input.
* **Processor** Is a source to source transformation that receives a source file name and content and returns modified source file content.
* **Transformer**: Is a TypeScript ScriptFile to ScriptFile transformation that receives a ScriptFile and returns the modified ScriptFile.
* **ResultProcessor**: Is a processors that receives the list of all output files of a target and generates additional information for the target.
