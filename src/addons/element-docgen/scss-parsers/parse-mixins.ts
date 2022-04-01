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
import { Node, parse } from "scss-parser";
import ts from "typescript";
import { ErrorMessage, Reporter } from "../../../model";

export interface Mixin {
    name: string;
    description: string;
    privacy: string;
    type: string;
    parameters: string[];
}

const getChildNode = (node: Node, type: string): Node | undefined => {
    if (!isString(node.value)) {
        return node.value.find(subNode => subNode.type === type);
    }
    return undefined;
};

const getChildString = (node: Node, type: string): string | undefined => {
    if (!isString(node.value)) {
        const childNode = node.value.find(subNode => subNode.type === type);
        if (childNode && isString(childNode.value)) {
            return childNode.value;
        }
    }
    return undefined;
};

interface AggregatedDescription {
    text: string;
    quoted?: boolean;
}

export const readMixins = (path: string, reporter: Reporter, system: ts.System): { [key: string]: Mixin[] } => {
    const mixins: { [key: string]: Mixin[] } = {};
    system.readDirectory(path).forEach(directoryName => {
        const dirPath = path + "/" + directoryName;
        if (dirPath && system.directoryExists(dirPath)) {
            system.readDirectory(dirPath).forEach(fileName => {
                const filePath = dirPath + "/" + fileName;
                if (fileName.startsWith("_") && fileName.endsWith(".scss")) {
                    if (system.fileExists(filePath)) {
                        try {
                            mixins["qs-" + directoryName] = parseMixins(system.readFile(filePath) ?? "");
                        } catch (err) {
                            reporter.reportDiagnostic(new ErrorMessage(`Error processing '${filePath}': ${err}`));
                        }
                    }
                }
            });
        }
    });
    return mixins;
};

export const parseMixins = (styles: string): Mixin[] => {
    if (!styles) {
        return [];
    }

    const mixins: Mixin[] = [];
    const node = parse(styles);
    let description: AggregatedDescription = { text: "" };

    if (!isString(node.value)) {
        node.value.forEach(cur => {
            switch (cur.type) {
                case "atrule": {
                    if (description.text && getChildNode(cur, "atkeyword")?.value === "mixin") {
                        const identifier = getIdentifier(cur);
                        const parameters = getParameters(cur);
                        const type = styles.substring(
                            (cur.start?.cursor || 0) + "@mixin ".length,
                            getChildNode(cur, "block")?.start?.cursor || (cur as any).next?.cursor || cur.start?.cursor
                        );
                        if (identifier) {
                            mixins.push({
                                description: description.text,
                                name: `@mixin ${identifier}()`,
                                parameters,
                                privacy: "public",
                                type,
                            });
                        }
                    }
                }
            }
            description = aggregateDescription(cur, description);
        });
    }

    return mixins;
};

const aggregateDescription = (node: Node, aggregatedDescription: AggregatedDescription): AggregatedDescription => {
    let result: AggregatedDescription = aggregatedDescription;
    switch (node.type) {
        case "declaration":
        case "rule":
        case "atrule": {
            result = { text: "" };
            break;
        }
        case "comment_singleline": {
            if (isString(node.value) && node.value.startsWith("/ ")) {
                result = aggregateDescriptionLine(node.value.substring(2), aggregatedDescription);
            }
            break;
        }
    }
    return result;
};

const aggregateDescriptionLine = (line: string, aggregatedDescription: AggregatedDescription): AggregatedDescription => {
    if (!line.trim()) {
        return aggregatedDescription;
    }
    if (!aggregatedDescription.quoted) {
        line = line.trim();
    }

    const quoteStart = line.indexOf("```");
    if (quoteStart === 0) {
        line = line.replace(/```([^\s]*)/, "```");
        return aggregateDescriptionLine(line.substring(3), {
            quoted: !aggregatedDescription.quoted,
            text: aggregatedDescription.text + (aggregatedDescription.quoted ? "\n" : "\n\n") + "```",
        });
    }
    if (quoteStart > 0) {
        return aggregateDescriptionLine(line.substring(quoteStart), aggregateDescriptionLine(line.substring(0, quoteStart), aggregatedDescription));
    }

    if (aggregatedDescription.quoted) {
        return {
            quoted: true,
            text: aggregatedDescription.text + "\n" + line,
        };
    }

    let delimiter = aggregatedDescription.text ? "\n" : "";

    // tick variable names
    line = line.replace(/^@([^\s]*)([\s]*)({[^\s]*})?([\s]*)?(\$[^\s]*)/, "@$1$2`$3$4$5`");
    line = escapeMarkdown(line);

    if (line.startsWith("@")) {
        line = line.replace(/@([^\s]*)/, "**@$1**");
        if (aggregatedDescription.text) {
            delimiter = "\n\n";
        }
    }

    return {
        text: `${aggregatedDescription.text}${delimiter}${line}`,
    };
};

export const escapeMarkdown = (line: string): string => {
    // minimal algorithm ignoring ticked sections
    const tickStartPos = line.indexOf("`");
    if (tickStartPos > 0) {
        const tickEndPos = line.indexOf("`", tickStartPos + 1);
        if (tickEndPos > 0) {
            return (
                escapeMarkdown(line.substring(0, tickStartPos)) +
                line.substring(tickStartPos, tickEndPos + 1) +
                escapeMarkdown(line.substring(tickEndPos + 1))
            );
        }
    }
    return line.replace(/([\\`*_{}[\]()#+-.!])/g, "\\$1");
};

const getIdentifier = (node: Node): string | undefined => {
    return getChildString(node, "identifier");
};

const getParameters = (node: Node): string[] => {
    const parameters: string[] = [];
    const argumentsNode = getChildNode(node, "arguments");
    if (argumentsNode && !isString(argumentsNode?.value)) {
        argumentsNode.value.forEach(argument => {
            if (argument.type === "declaration") {
                const property = getChildNode(argument, "property");
                if (property && !isString(property.value)) {
                    const variable = getChildNode(property, "variable");
                    if (variable && isString(variable.value)) {
                        parameters.push(variable.value);
                    }
                }
            }
            if (argument.type === "variable") {
                if (isString(argument.value)) {
                    parameters.push(argument.value);
                }
            }
        });
    }
    return parameters;
};

const isString = (value: string | Node[]): value is string => {
    return typeof value === "string";
};
