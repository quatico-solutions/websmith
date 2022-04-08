<!--
 @license

 Copyright (c) 2017-2022 Quatico Solutions AG
 Förrlibuckstrasse 220, 8005 Zurich, Switzerland

 All Rights Reserved.

 This software is the confidential and proprietary information of
 Quatico Solutions AG, ("Confidential Information"). You shall not
 disclose such Confidential Information and shall use it only in
 accordance with the terms of the license agreement you entered into
 with Quatico.
-->

# Write your own addon

Inside your addons directory, create a directory that contains a file `addon.ts`. This file is called the addon activator and it requires a function `activate(ctx: CompilationContext)`. The activator is called before the compilation process to register the addon in the appropriate step during the compilation process.

You can register several kinds of addons: `Generator`, `Processor`, `Transformer` and `TargetPostTransformer`

- `Generators` can be used to create additional files (eg documentation) based on your source code files.
- `Processor` can be used to alter a source input file during the compilation.
- `Transformer` can be used to alter the generated JavaScript result during the JS emission phase.
- `TargetPostTransformer` can be used to execute project wide functionality after the compilation has finished and all `Transformers` have been executed.

... your addon can use external dependencies ...

- import dependencies and add them as devDependencies to your package.json.
  - those are not included in the compilation of your target code

... The structure of your addon folder is up to you, websmith interacts only with the addon activator ...

... The addon directory is not subject to the websmith compilation process ...

## Choose your addon kind

- `Generators` are executed first. They can not alter the source code, ensuring that the generators can act upon the unmodified code as created by the developer.
- `Processors` are executed after `Generators` but before the standard TypeScript compilation and allow you to alter the source code to alter aspects that with TypeScripts CustomTransformers are not able to change anymore. Examples: adding and removing imports, exports or functions.
- `Transformers` are [standard TypeScript CustomTransformers](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#traversing-the-ast-with-a-little-linter) that allow you to modify the code as the TypeScript to JavaScript transpilation takes place. By their nature, CustomTransformers executed during TypeScript compilation can not alter the signature of existing code anymore. If you wish to do that, you can use your transformer with the ts.Transform function in a `Processors`.

### Addon execution flow

```plantuml
@startuml
participant compiler
entity sourceCode
collections generators
collections transformers
collections emitters
loop for each source code file
    create sourceCode
    compiler -> sourceCode: read
    compiler -> generators: apply(fileName, sourceCode)
    compiler -> processors: sourceCode = apply(fileName, sourceCode)
    compiler -> transformers: merge
    transformers --> compiler: mergedTransformers
    compiler -> TypeScript: emit(fileName, mergedTransformers)
    compiler -> targetPostTransformers: transform(allSourceFileNames)
end
@enduml
```

### Generator

- `Generators` are executed before the compilation and enable you to act upon the unaltered input source code.

#### Example: export-yaml-generator

The goal of the export collector is to collect all exported functions and list them in a YAML. This output can be consumed by other tools as part of a delivery process for security audit, generating additional data like processing (s)css or documentation.

**export-yaml-generator/addon.ts**

```javascript
import { AddonContext, ErrorMessage, Generator } from "@websmith/addon-api";
import ts from "typescript";
import { createTransformer, resetOutput } from "./export-transformer";

/**
 * Registers the generator for the given addon context.
 *
 * @param ctx AddonContext for the compilation.
 */
export const activate = (ctx: AddonContext): void => {
    resetOutput(ctx);
    ctx.registerGenerator(createGenerator(ctx));
};

/**
 * Generator for the export-yaml-generator addon.
 *
 * @param ctx
 * @returns A websmith generator factory function.
 */
const createGenerator =
(ctx: AddonContext): Generator =>
(fileName: string, fileContent: string): void => {
    const file = ts.createSourceFile(fileName, fileContent, ctx.getConfig().options.target ?? ts.ScriptTarget.Latest, true);
    const result = ts.transform(file, [createTransformer(ctx.getSystem())], ctx.getConfig().options);
    
    if (result.diagnostics && result.diagnostics.length > 0) {
        result.diagnostics.forEach(it => ctx.getReporter().reportDiagnostic(new ErrorMessage(it.messageText, file)));
    }
    
    if (result.transformed.length < 1) {
        ctx.getReporter().reportDiagnostic(new ErrorMessage(`exportCollector failed for ${fileName} without identifiable error.`, file));
    }
};

```

**export-yaml-generator/export-transformer.ts**

```javascript
import { AddonContext } from "@websmith/addon-api";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import ts from "typescript";

/**
 * Target file path for the generated export file.
 */
const OUTPUT_FILE_PATH = "lib/output.yaml";

/**
 * Creates a transformer that collects all names of exported functions and variables.
 *
 * @param system The TS system to use.
 * @returns A TS transformer factory.
 */
export const createTransformer = (system: ts.System): ts.TransformerFactory<ts.SourceFile> => {
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (input: ts.SourceFile): ts.SourceFile => {
            const foundDecls: string[] = [];

            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                // Visit child nodes of source files
                if (ts.isSourceFile(node)) {
                    return ts.visitEachChild(node, visitor, ctx);
                }

                // Collect node identifier if it is exported and a function or variable
                if (
                    node.modifiers?.some(it => it.kind === ts.SyntaxKind.ExportKeyword) &&
                    (ts.isVariableStatement(node) || ts.isFunctionDeclaration(node))
                ) {
                    foundDecls.push(getName(node));
                }

                return node;
            };

            input = ts.visitNode(input, visitor);

            // Write collected identifiers to hard coded output file
            writeFileSync(system.resolvePath(OUTPUT_FILE_PATH), createFileContent(input.fileName, foundDecls, system));
            return input;
        };
    };
};

/**
 * Appends the given names to the output file.
 *
 * @param filePath The path to the file.
 * @param names The names to append.
 * @param system The TS system to use.
 * @returns The new content to append to the file.
 */
const createFileContent = (filePath: string, names: string[], system: ts.System): string => {
    const fileContent = getOrCreateFile(system.resolvePath(OUTPUT_FILE_PATH));
    const existingFileContent = fileContent ? `${fileContent}\n` : "";
    const exports = names.length > 0 ? `\nexports: [${names.join(",")}]\n` : "";
    return `${existingFileContent}-file: "${filePath}"${exports}`;
};

/**
 * Returns identifier for function or variable declaration, or empty string for nodes of different types.
 *
 * @param node The node to get the name from.
 * @returns Node name or empty string.
 */
const getName = (node: ts.Node): string => {
    if (ts.isFunctionDeclaration(node)) {
        return node.name?.getText() ?? "unknown";
    } else if (ts.isVariableStatement(node)) {
        return node.declarationList?.declarations[0]?.name?.getText() ?? "unknown";
    }
    return "";
};

/**
 * Returns the content of the file or creates a new file if it does not exist.
 *
 * @param filePath The path to the file.
 * @returns The content of the file or empty string if the file does not exist.
 */
const getOrCreateFile = (filePath: string): string => {
    if (!existsSync(dirname(filePath))) {
        mkdirSync(dirname(filePath), { recursive: true });
    }
    if (!existsSync(filePath)) {
        writeFileSync(filePath, "");
    }
    return readFileSync(filePath).toString();
};

export const resetOutput = (ctx: AddonContext): void => {
    ctx.getSystem().writeFile(ctx.getSystem().resolvePath(OUTPUT_FILE_PATH), "");
};

```

### Processors

`Processors` are execute before the TypeScript compilation step and allow you to alter all aspects of the code. `Processors` are in required in particular to add or remove imports, functions or dependencies on other modules. While this can in theory be done in `Transformers`, the TypeScript compilation will not be able to resolve such changes anymore yielding failing code when adding module dependencies and incorrect D.TS output files.
It is possible to use ts.Transform in `Processors` to reuse existing TypeScript CustomTransformers in this setup to achieve the desired code transformations.

> Note: Processors are executed one by one unlike Transformers, that are merged and yield a single TypeScript execution.

#### Example: foobar-replace-processor

**foobar-replace-processor/addon.ts**

```javascript
import { AddonContext, ErrorMessage, Processor } from "@websmith/addon-api";
import ts from "typescript";
import { createTransformer } from "./foobar-transformer";

export const activate = (ctx: AddonContext): void => {
    ctx.registerProcessor(createProcessor(ctx));
};

/**
 * Creates a processor that uses a TS transformer to replace every found "foobar" identifier with "barfoo".
 *
 * @param ctx The addon context for the compilation.
 * @returns A websmith processor factory function.
 */
const createProcessor =
    (ctx: AddonContext): Processor =>
    (fileName: string, content: string): string => {
        const file = ts.createSourceFile(fileName, content, ctx.getConfig().options.target ?? ts.ScriptTarget.Latest, true);
        const result = ts.transform(file, [createTransformer()], ctx.getConfig().options);
        if (result.diagnostics && result.diagnostics.length > 0) {
            result.diagnostics.forEach(it => ctx.getReporter().reportDiagnostic(new ErrorMessage(it.messageText, file)));
            return "";
        }
        if (result.transformed.length > 0) {
            return ts.createPrinter().printFile(result.transformed[0]);
        }
        ctx.getReporter().reportDiagnostic(new ErrorMessage(`Foobar-Replacer failed for ${fileName} without identifiable error.`, file));
        return "";
    };

```

**foobar-replace-processor/foobar-transformer.ts**

```javascript
import ts from "typescript";

/**
 * Create a transformer that replaces every "foobar" identifier with "barfoo".
 *
 * @returns A TS transformer factory.
 */
export const createTransformer = (): ts.TransformerFactory<ts.SourceFile> => {
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sf: ts.SourceFile) => {
            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                // Visit child nodes of source files
                if (ts.isSourceFile(node)) {
                    return ts.visitEachChild(node, visitor, ctx);
                }
                // Replace foobar with barfoo identifiers
                if (ts.isIdentifier(node)) {
                    const identifier = node.getText();
                    if (identifier.match(/foobar/gi)) {
                        return ctx.factory.createIdentifier(identifier.replace(/foobar/gi, "barfoo"));
                    }
                    if (identifier.match(/barfoo/gi)) {
                        return ctx.factory.createIdentifier(identifier.replace(/barfoo/gi, "foobar"));
                    }
                }
                return ts.visitEachChild(node, visitor, ctx);
            };
            return ts.visitNode(sf, visitor);
        };
    };
};

```

### Transformer

Transformer follow the standard TypeScript `ts.CustomTransformers` approach, providing a factory that takes in a TransformationContext and returning a Transformer for SourceFiles.

#### Example: foobar-replace-transformer

**foobar-replace-transformer/addon.ts**

```javascript
import { AddonContext } from "@websmith/addon-api";
import ts from "typescript";

export const activate = (ctx: AddonContext): void => {
    ctx.registerTransformer({ before: [createTransformer()] });
};

/**
 * Create a transformer that replaces every "foobar" identifier with "barfoo".
 *
 * @returns A TS transformer factory.
 */
export const createTransformer = (): ts.TransformerFactory<ts.SourceFile> => {
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sf: ts.SourceFile) => {
            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                // Visit child nodes of source files
                if (ts.isSourceFile(node)) {
                    return ts.visitEachChild(node, visitor, ctx);
                }
                // Replace foobar with barfoo identifiers
                if (ts.isIdentifier(node)) {
                    const identifier = node.getText();
                    if (identifier.match(/foobar/gi)) {
                        return ctx.factory.createIdentifier(identifier.replace(/foobar/gi, "barfoo"));
                    }
                    if (identifier.match(/barfoo/gi)) {
                        return ctx.factory.createIdentifier(identifier.replace(/barfoo/gi, "foobar"));
                    }
                }
                return ts.visitEachChild(node, visitor, ctx);
            };
            return ts.visitNode(sf, visitor);
        };
    };
};

```

### TargetPostTransformer

TargetPostTransformer follow the same approach as `Generator` but are executed after the compilation has been finished.
The difference is that they are executed executed only once **per target**, not once **per file**.

#### Example: tag-collector-transformer

**tag-collector-transformer/addon.ts**

```javascript
import { AddonContext } from "@websmith/addon-api";
import { createTargetPostTransformer } from "./target-post-transformer";

export const activate = (ctx: AddonContext) => {
    ctx.registerTargetPostTransformer((fileNames: string[]) => createTargetPostTransformer(fileNames, ctx));
};
```

**tag-collector-transformer/target-post-transformer.ts**

```javascript
import { AddonContext } from "@websmith/addon-api";
import { join } from "path";
import ts from "typescript";

/**
 * Gets the output file path for the given output directory.
 *
 * @param outDir The output directory for the generated files.
 * @returns The output file path.
 */
const getOutputFilePath = (outDir: string) => join(outDir, "annotatedFunctions.yaml");

/**
 * Creates a TargetPostProcessor that collects all functions and arrow functions with a // @service() comment.
 *
 * @param fileNames The file names of the current target to process.
 * @param ctx The addon context for the compilation.
 * @returns A websmith TargetPostTransformer factory function.
 */
export const createTargetPostTransformer = (fileNames: string[], ctx: AddonContext) => {
    const outDir = ctx.getConfig().options.outDir ?? process.cwd();
    ctx.getSystem().writeFile(join(outDir, "serviceFunctions.yaml"), "");
    fileNames
        .filter(fn => fn.match(/\.tsx?/gi))
        .map(fn => {
            const sf = ts.createSourceFile(fn, ctx.getFileContent(fn), ctx.getConfig().options.target ?? ts.ScriptTarget.Latest);
            ts.transform(sf, [createTransformerFactory(ctx.getSystem(), outDir)], ctx.getConfig().options);
        });
};

/**
 * Create a transformer that collects all functions and arrow functions with a // @service() comment.
 *
 * @param sys The ts.System for the transformation.
 * @param outDir The output directory for the generated files.
 * @returns A TS TransformerFactory.
 */
const createTransformerFactory = (sys: ts.System, outDir: string): ts.TransformerFactory<ts.SourceFile> => {
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sf: ts.SourceFile) => {
            const output =
                sys
                    .readFile(getOutputFilePath(outDir))
                    ?.split("\n")
                    .filter(line => line !== undefined && line.length > 0) ?? [];

            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                if (ts.isSourceFile(node)) {
                    ts.visitEachChild(node, visitor, ctx);
                }

                if (isAnnotated(node, sf)) {
                    if (ts.isFunctionDeclaration(node)) {
                        output.push(`- ${node.name?.getText(sf) ?? "unknown"}`);
                    } else if (ts.isVariableStatement(node)) {
                        output.push(`- ${getVariableName(node, sf)}`);
                    }
                }

                return node;
            };

            sf = ts.visitNode(sf, visitor);

            sys.writeFile(getOutputFilePath(outDir), `${output.join("\n")}`);
            return sf;
        };
    };
};

/**
 * Checks if the given node is annotated with a // @annotated() comment.
 * 
 * @param node The node to check.
 * @param sf The source file that contains the node.
 * @returns True if the node is annotated with a @annotated() comment.
 */
const isAnnotated = (node: ts.Node, sf: ts.SourceFile) => {
    return node.getFullText(sf).match(/\/\/.*@annotated\(.*\)/gi);
};

/**
 * Gets the name of the given variable statement.
 *
 * @param variableStatement The TS VariableStatement to get the name from.
 * @param sf The TS SourceFile that contains this variable statement.
 * @returns The name of the variable in the given statement.
 */
const getVariableName = (variableStatement: ts.VariableStatement, sf: ts.SourceFile): string => {
    return variableStatement.declarationList.declarations[0].name.getText(sf);
};
```

#### Important Note

The same TypeScript TransformerFactories we used in the `Processor` and `Generator` addons above can also be used as `Transformer` addons as we did above.
But we must keep in mind, that `Processor` addons are executed after TypeScript has parsed the code and in essence generated the D.TS file. When using the foobarReplacer Factory for an `Transformer` addon as shown above, the resulting transformed JavaScript code will be identical to the `Processor` addon, but because we rewrite the signature of the functions (foobar1 to barfoo1), the generated D.TS file will no longer match.

For the input

```javascript
export const foobar1 = ():string => {
    return "foobar1";
}
```

both Processor and Transformer addons yield the following JavaScript output

```javascript
export const barfoo1 = () => {
    return "foobar1";
}
```

but the Processor Addon will yield

**Processor .d.ts**

```javascript
export declare const barfoo1: () => string;
```

while the Transformer Addon will yield

**Transformer .d.ts**

```javascript
// The signature of foobar has not been transformed.
export declare const foobar1: () => string;
```

## Additional Examples and Information

The official TypeScript has additional examples, for example [a delint Transformer documentation](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#traversing-the-ast-with-a-little-linter).

Further examples and indepth explanations for TypeScript code transformation can be found in the [TypeScript Transformer Handbook](https://github.com/madou/typescript-transformer-handbook).

When writing ts.Transform or Transformer based addons, we recommend to use [the AST Explorer](https://astexplorer.net/) and [the TS Creator](https://ts-creator.js.org/) as tools to aid your development.
VisualStudio Code users can leverage the extension [TypeScript AST Explorer](https://marketplace.visualstudio.com/items?itemName=krizzdewizz.vscode-typescript-ast-explorer).

## Error reporting

Websmith uses a `Reporter` to communicate info, warning and error messages while respecting the current debug option. `context.getReporter()` can be used on the context in your activate function to access this reporter.

```javascript
export const createTransformer = (fileName: string, content: string, ctx: AddonContext): string => {
    if(content === "") {
        ctx.getReporter().reportDiagnostic(new ErrorMessage(`No content to transform for ${fileName}`));
        return "";
    }

    return executeTransformation(fileName, content, ctx);
}
```

### API

```javascript
interface Reporter {
    reportDiagnostic(DiagnosticMessage): void
}

// Possible types of DiagnosticMessages you can create
class InfoMessage extends DiangnosticMessage { constructor(message: string) }
class WarnMessage extends DiagnosticMessage { constructor(message: string) }
class ErrorMessage extends DiagnostcMessage { constructor(message: string) }
```

## How to interact with the compiler: AddonContext explained

```javascript
interface AddonContext<O extends TargetConfig> {
    getSystem(): ts.System;
    getProgram(): ts.Program;
    getConfig(): ts.ParsedCommandLine;
    getReporter(): Reporter;
    getTargetConfig(): O

    registerGenerator((fileName, fileContent) => void);
    registerProcessor((fileName, fileContent) => transformedFileContent);
    registerTransformer(ts.CustomTransformers);
    registerTargetPostTransformer((fileNames) => void)
}
```
