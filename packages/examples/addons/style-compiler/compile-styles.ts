/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
import { ErrorMessage, InfoMessage, Processor, Reporter } from "@websmith/addon-api";
import sass from "sass";
import ts from "typescript";
import { getBaseName, isScriptFile } from "./elements";
import { createSass } from "../sass-compiler";
import { CustomStyleTransformers } from "./CustomStyleTransformers";
import { inlineStyles, isStyleImport } from "./inline-styles";
import { parseStyles, visitNode, writeNode } from "./parse-scss";
import { StyleTransformer } from "./StyleTransformer";

export interface StyleCompilerOptions {
    sassOptions?: sass.Options<"sync">;
    reporter: Reporter;
    system: ts.System;
}

export const createStyleCompiler = (options: StyleCompilerOptions, transformers: CustomStyleTransformers): Processor => {
    const { sassOptions, reporter, system } = options;

    const compileSass = createSass(sassOptions ?? {}, reporter);
    const result = (fileName: string, content: string): string | never => {
        const sf = ts.createSourceFile(fileName, content, ts.ScriptTarget.ESNext, /*setParentNodes */ true);
        return ts.visitNode(sf, visitor).text;
    };
    const visitor: ts.Visitor = node => {
        if (isScriptFile(node)) {
            const file: ts.SourceFile = node;
            const stylePaths = resolveStyleImports(file, system);

            if (stylePaths.length === 0) {
                return file;
            }

            reporter.reportWatchStatus(new InfoMessage(`Compiling SCSS '${getBaseName(file.fileName)}' ...`));
            try {
                // Compile every imported style with Sass
                const compiledStyles = stylePaths.map(path => {
                    let styles = system.readFile(path);
                    if (!styles) {
                        throw new Error(`Could not read file from '${path}'.`);
                    }

                    if (transformers.before) {
                        transformers.before.forEach(transformer => {
                            styles = tryTransform(styles!, transformer);
                        });
                    }

                    let compiled = compileSass(styles);

                    if (transformers.after) {
                        transformers.after.forEach(transformer => {
                            compiled = tryTransform(compiled, transformer);
                        });
                    }

                    return compiled;
                });

                // Create or update importedStyles method in first class declaration
                return inlineStyles(file, compiledStyles);
            } catch (error) {
                reporter.reportDiagnostic(new ErrorMessage(error.message, file));
            } finally {
                reporter.reportWatchStatus(new InfoMessage("Done."), system.newLine);
            }
        }
        return node;
    };
    return result;
};

export const resolveStyleImports = (file: ts.SourceFile, system: ts.System): string[] => {
    const importPrefixPath = file.fileName.substring(0, file.fileName.lastIndexOf("/"));
    return file.statements
        .filter(cur => isStyleImport(cur))
        .map(stmt => {
            // @ts-ignore custom property access 'text'
            const basename = getBaseName(stmt.moduleSpecifier?.text);
            return system.resolvePath(`${importPrefixPath}/${basename}`);
        });
};

export const tryTransform = (styles: string, transformer: StyleTransformer): string => {
    try {
        let root = parseStyles(styles);
        root = visitNode(root, transformer.visitor);
        return writeNode(root);
    } catch (error) {
        transformer.reporter.reportDiagnostic(new ErrorMessage(`${error.message}`));
        return styles;
    }
};
