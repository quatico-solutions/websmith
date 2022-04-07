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

You can register several kinds of addons: `Generator`, `Processor`, `Transformer` and `ProjectPostTransformer`

- `Generators` can be used to create additional files (eg documentation) based on your source code files.
- `Processor` can be used to alter a source input file during the compilation.
- `Transformer` can be used to alter the generated JavaScript result during the JS emission phase.
- `ProjectPostTransformer` can be used to execute project wide functionality after the compilation has finished and all `Transformers` have been executed.

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
    compiler -> projectPostTransformers: transform(allSourceFileNames)
end
@enduml
```

### Generator

- `Generators` are executed before the compilation and enable you to act upon the unaltered input source code.

#### Example: export-collector

The goal of the export collector is to collect all exported functions and list them in a YAML. This output can be consumed by other tools as part of a delivery process for security audit, generating additional data like processing (s)css or documentation.

**exportCollector/addon.ts**

```javascript
import type { AddonContext } from "@websmith/addon-api";
import { createExportCollector } from "./export-collector";

export const activate = (ctx: AddonContext) => {
    ctx.registerGenerator((fileName, content) => createExportCollector(fileName, content, ctx));
}
```

**exportCollector/export-collector.ts**

```javascript
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import ts from "typescript";
import type { AddonContext } from "@websmith/addon-api";
import { ErrorMessage } from "@websmith/addon-api"; 

export const createExportCollector = (fileName: string, content: string, ctx: AddonContext): void => {
    const sf = ts.createSourceFile(fileName, content, ctx.getConfig().options.target ?? ts.ScriptTarget.Latest, true);
    const transformResult = ts.transform(sf, [createExportCollectorFactory()], ctx.getConfig().options);

    if (transformResult.diagnostics && transformResult.diagnostics.length > 0) {
        transformResult.diagnostics.forEach(it => ctx.getReporter().reportDiagnostic(new ErrorMessage(it.messageText, sf)));
    }

    if (transformResult.transformed.length < 1) {
        ctx.getReporter().reportDiagnostic(new ErrorMessage(`exportCollector failed for ${fileName} without identifiable error.`, sf));
    }
};

const createExportCollectorFactory = () => {
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sf: ts.SourceFile) => {
            const exportFileContent = getOrCreateOutputFile(resolve("./output.yaml"));
            const foundDeclarations: string[] = [];

            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                if (ts.isSourceFile(node)) {
                    return ts.visitEachChild(node, visitor, ctx);
                }

                if (
                    node.modifiers?.some(it => it.kind === ts.SyntaxKind.ExportKeyword) &&
                    (ts.isVariableStatement(node) || ts.isFunctionDeclaration(node))
                ) {
                    foundDeclarations.push(getIdentifier(node));
                }

                return node;
            };

            sf = ts.visitNode(sf, visitor);

            writeFileSync(resolve("./output.yaml"), getYAMLOutput(exportFileContent, sf.fileName, foundDeclarations));
            return sf;
        };
    };
};

const getYAMLOutput = (exportFileContent: string, fileName: string, foundDeclarations: string[]): string => {
    const existingFileContent = exportFileContent ? exportFileContent + "\n" : "";
    const exportedDeclarations = foundDeclarations.length > 0 ? `\nexports: [${foundDeclarations.join(",")}]\n` : "";
    return `${existingFileContent}-file: "${fileName}"${exportedDeclarations}`;
};

const getIdentifier = (node: ts.FunctionDeclaration | ts.VariableStatement): string => {
    if (ts.isFunctionDeclaration(node)) {
        return node.name?.getText() ?? "unknown";
    } else if (ts.isVariableStatement(node)) {
        return node.declarationList?.declarations[0]?.name?.getText() ?? "unknown";
    }
    return "";
};

const getOrCreateOutputFile = (fileName: string): string => {
    if (!existsSync(fileName)) {
        writeFileSync(fileName, "");
    }
    return readFileSync(fileName).toString();
};
```

### Processors

`Processors` are execute before the TypeScript compilation step and allow you to alter all aspects of the code. `Processors` are in required in particular to add or remove imports, functions or dependencies on other modules. While this can in theory be done in `Transformers`, the TypeScript compilation will not be able to resolve such changes anymore yielding failing code when adding module dependencies and incorrect D.TS output files.
It is possible to use ts.Transform in `Processors` to reuse existing TypeScript CustomTransformers in this setup to achieve the desired code transformations.

> Note: Processors are executed one by one unlike Transformers, that are merged and yield a single TypeScript execution.

**foobarReplacer/addon.ts**

```javascript
import type { AddonContext } from "@websmith/addon-api";
import { createFoobarReplacerTransformer } from "./foobar-replacer";

export const activate = (ctx: AddonContext): void => {
    ctx.registerProcessor((fileName, content) => createFoobarReplacerProcessor(fileName, content, ctx));
};

```

**foobarReplacer/foobar-replacer.ts**

```javascript
import ts from "typescript";
import type { AddonContext } from "@websmith/addon-api";
import { ErrorMessage } from "@websmith/addon-api"; 

export const createFoobarReplacerProcessor = (fileName: string, content: string, ctx: AddonContext): string => {
    const sf = ts.createSourceFile(fileName, content, ctx.getConfig().options.target ?? ts.ScriptTarget.Latest, true);
    const transformResult = ts.transform(sf, [createFoobarReplacerFactory()], ctx.getConfig().options);
    if (transformResult.diagnostics && transformResult.diagnostics.length > 0) {
        transformResult.diagnostics.forEach(it => ctx.getReporter().reportDiagnostic(new ErrorMessage(it.messageText, sf)));
        return "";
    }

    if (transformResult.transformed.length > 0) {
        return ts.createPrinter().printFile(transformResult.transformed[0]);
    }

    ctx.getReporter().reportDiagnostic(new ErrorMessage(`foobarReplacer failed for ${fileName} without identifiable error.`, sf));
    return "";
};

export const createFoobarReplacerFactory = () => {
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sf: ts.SourceFile) => {
            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                if (ts.isSourceFile(node)) {
                    return ts.visitEachChild(node, visitor, ctx);
                }

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

**foobarReplaceEmitter/addon.ts**

```javascript
import { AddonContext } from "@websmith/addon-api";
import { createFoobarReplacerFactory } from "../foobarReplacer/foobar-replacer";

export const activate = (ctx: AddonContext): void => {
    ctx.registerTransformer({ before: [createFoobarReplacerFactory()] });
};
```

### TargetPostTransformer
**targetAddon/addon.ts**
```javascript
// FIXME: TO BE ADDED
```

**targetAddon/targetProcessor.ts**
```javascript
// FIXME: TO BE ADDED
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
