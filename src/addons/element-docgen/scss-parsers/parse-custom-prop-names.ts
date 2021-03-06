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
import { uniq } from "lodash";
import { Node } from "scss-parser";
import { parseStyles, visitNode } from "../../../compiler/style-compiler";

export const parseCustomPropertyNames = (styles: string): string[] => {
    if (!styles) {
        return [];
    }

    const root = parseStyles(styles);
    if (isString(root.value)) {
        return [root.value];
    }

    const results: string[] = [];
    visitNode(root, {
        visitArguments: (node: Node) => parseNames(node, results, true),
        visitIdentifier: (node: Node) => parseNames(node, results),
        visitOperator: (node: Node) => parseNames(node, results),
        visitProperty: (node: Node) => parseNames(node, results, true),
        visitPunctuation: (node: Node) => parseNames(node, results),
        visitSpace: (node: Node) => parseNames(node, results),
    });

    // remove partial names
    let index = 0;
    while (index < results.length) {
        const cur = results[index];
        if (["", "-"].includes(cur)) {
            results.splice(index, 1);
        } else {
            ++index;
        }
    }

    // remove duplicates
    return uniq(results);
};

export const parseNames = (node: Node, results: string[], continueVisit: boolean = false): boolean => {
    parseNodeValue(node, results);
    return continueVisit;
};

/**
 * Concat node values that belong to a custom property name, and separate names from each other.
 */
export const parseNodeValue = (node: Node, prevValues: string[]): string[] => {
    if (isString(node.value)) {
        const namePart = prevValues.pop() || "";
        if (isNameStart(node, namePart)) {
            prevValues.push(node.value);
        } else if (isNamePart(node, namePart)) {
            prevValues.push(`${namePart}${node.value}`);
        } else if (isNameEnd(node, namePart)) {
            prevValues.push(namePart);
            prevValues.push("");
        } else {
            prevValues.push("");
        }
    }

    return prevValues;
};

/**
 * Returns true iff
 *  "--" and { type: "identifier"},
 *  "-" or "" and { type: operator }
 */
export const isNamePart = (node: Node, namePart: string): boolean => {
    switch (node.type) {
        case "identifier":
            return namePart === "--";
        case "operator":
            return node.value === "-" && ["-", ""].includes(namePart);
        default:
            return false;
    }
};

/**
 * Returns true iff "" and { type: "operator", value: "-" }
 */
export const isNameStart = (node: Node, namePart: string): boolean => {
    return node.type === "operator" && node.value === "-" && namePart === "";
};

/**
 * Returns true iff non-empty namePart and
 *  { type: "parentheses" },
 *  { type: "punctuation" },
 *  { type: "space"}
 */
export const isNameEnd = (node: Node, namePart: string): boolean => {
    switch (node.type) {
        case "parentheses":
        case "punctuation":
        case "space":
            return namePart?.length > 0;
        default:
            return false;
    }
};

const isString = (value: string | Node[]): value is string => {
    return typeof value === "string";
};
