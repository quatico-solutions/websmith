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
import { AddonContext, ErrorMessage, Reporter } from "@websmith/addon-api";
import ts from "typescript";
import {
    AnalyzerOptions,
    AnalyzerResult,
    analyzeSourceFile,
    transformAnalyzerResult,
    TransformerConfig,
    VisibilityKind,
} from "web-component-analyzer";
import { isScriptFile } from "../style-compiler";
import { defaultOptions, DocDefaults } from "./defaults";
import { addCustomPropNames, addMixins, transformTag } from "./docgen";
import { Element } from "./model";
import { readCustomPropNames } from "./scss-extractors/extract-custom-prop-names";
import { readMixins } from "./scss-parsers/parse-mixins";

export class DocGenerator {
    private results: AnalyzerResult[];
    private config: DocDefaults & DocOptions;

    constructor(options: DocOptions) {
        this.results = [];
        this.config = { ...defaultOptions, ...options };
    }

    public getResults() {
        return this.results;
    }

    public getResultProcessor(fileNames: string[], ctx: AddonContext) {
        try {
            const program = ctx.getProgram();
            const system = ctx.getSystem();

            const config: TransformerConfig = {
                inlineTypes: this.config.inlineTypes,
                visibility: this.config.visibility,
            };
            const output = transformAnalyzerResult("json", this.results, program as any, config);
            const data = JSON.parse(output) as Element;

            extractCustomPropertyDocs(data, this.config.reporter, system);
            extractMixinDocs(data, this.config.reporter, system);
            generateCustomPropertyDocs(data, this.config.reporter, system);

            system.writeFile(this.config.outputFile, JSON.stringify(data, null, 4));
        } catch (err) {
            ctx.getReporter().reportDiagnostic(new ErrorMessage(err.toString()));
        }
    }

    public getTransformer(ctx: AddonContext): ts.CustomTransformers {
        const options: AnalyzerOptions = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            program: ctx.getProgram() as any,
            verbose: this.config.verbose,
        };

        return {
            before: [
                (): ts.Transformer<ts.SourceFile> => {
                    return (sf: ts.SourceFile) => {
                        const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                            if (isScriptFile(node)) {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                this.results.push(analyzeSourceFile(node as any, options));
                            }
                            return node;
                        };
                        return ts.visitNode(sf, visitor);
                    };
                },
            ],
        };
    }
}

export interface DocOptions {
    inlineTypes?: boolean;
    reporter: Reporter;
    visibility?: VisibilityKind;
    verbose?: boolean;
    outputFile?: string;
}

/**
 * Extracts @cssprop documentation from JSDoc of all pattern *.ts files
 * and adds the description to the custom-element.json.
 *
 * @param elem
 */
export const extractCustomPropertyDocs = (elem: Element, reporter: Reporter, system: ts.System) => {
    elem.tags?.forEach(tag => transformTag(tag, reporter, system));
};
/**
 * Extracts SassDoc description for all @mixin definitions from *.scss
 * files and adds Markdown formatted descriptions to custom-elements.json.
 *
 * @param elem
 */
export const extractMixinDocs = (elem: Element, reporter: Reporter, system: ts.System) => {
    const mixins = readMixins("src", reporter, system);
    Object.keys(mixins).forEach(name => {
        let dataTag = elem.tags?.find(tag => tag.name === name);
        if (!dataTag) {
            dataTag = {
                name,
            };
            elem.tags?.push(dataTag);
        }

        addMixins(dataTag, mixins[name]);
    });
};

/**
 * Extracts used properties from SCSS files of pure perceptual patterns
 * and creates CSS custom property names. For all created custom properties
 * a description is created and added to the custom-elements.json.
 *
 * @param elem
 */
export const generateCustomPropertyDocs = (elem: Element, reporter: Reporter, system: ts.System) => {
    const customPropNames = readCustomPropNames("src", reporter, system);
    Object.keys(customPropNames).forEach(name => {
        if (customPropNames[name].length > 0) {
            let dataTag = elem.tags?.find(tag => tag.name === name);
            if (!dataTag) {
                dataTag = {
                    name,
                };
                elem.tags?.push(dataTag);
            }
            addCustomPropNames(dataTag, customPropNames[name], reporter);
        }
    });
};
