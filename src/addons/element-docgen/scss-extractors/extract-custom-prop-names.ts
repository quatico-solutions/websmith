/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
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
import fs from "fs";
import glob from "glob";
import path from "path";
import sass from "sass";
import dedent from "ts-dedent";
import { ErrorMessage, Reporter } from "../../../model";
import { filterAndSortCssProperties } from "./extract-custom-props";

export const IGNORED_FILES = ["**/*.spec.ts", "**/index.ts"];
export interface PropNames {
    [key: string]: string[];
}

export const extractCustomPropNames = (filePath: string, tagName: string, includePaths?: string[]): string[] => {
    const css = sass
        .renderSync({
            data: dedent`
                @use "../properties/lists" as *;
                @use "../properties/variables" as *;
                @use "${filePath}" as *;
                            
                @function custom-prop-names($element, $names) {
                    $result: ();
                    @each $name in $names {
                        $result: list-append($result, var-name($element, $name, $mapDsNames: true));
                    }
                    @return $result;
                }

                $properties: () !default;
                $names: $properties;
                @if function-exists(composite-props) {
                    $names : list-append($names, composite-props()); 
                }

                div {
                    @if (length($names) > 0) {
                    content: custom-prop-names("--${tagName}", $names);
                    } @else {
                    content: "";
                    }        
                }
            `,
            includePaths,
            indentType: "space",
            indentWidth: 4,
            linefeed: "lf",
            omitSourceMapUrl: true,
            outputStyle: "expanded",
        })
        .css.toString();

    const contentPos = css.lastIndexOf("content:");
    if (contentPos > 0) {
        const endPos = css.indexOf(";", contentPos);
        if (endPos > 0) {
            return css
                .substring(contentPos + 8, endPos)
                .split(",")
                .map(s => s.trim())
                .filter(s => s && s !== '""')
                .concat();
        }
    }
    return [];
};

export const readCustomPropNames = (root: string, reporter: Reporter, additionalIncludePaths: string[] = []): PropNames => {
    const result: PropNames = {};
    fs.readdirSync(root).forEach(name => {
        const dirPath = `${root}/${name}`;
        const tagName = `qs-${name}`;
        if (fs.statSync(dirPath)?.isDirectory()) {
            if (fs.existsSync(`${dirPath}/_${name}.scss`) && glob.sync(`${dirPath}/*.ts`, { ignore: IGNORED_FILES }).length === 0) {
                const filePath = `../${name}/_${name}.scss`;
                try {
                    result[tagName] = filterAndSortCssProperties(
                        tagName,
                        extractCustomPropNames(filePath, tagName, [path.resolve(`${root}/${name}`), ...additionalIncludePaths])
                    );
                } catch (error) {
                    reporter.reportDiagnostic(new ErrorMessage(`Error processing '${filePath}': ${error}\n`));
                }
            }
        }
    });
    return result;
};
