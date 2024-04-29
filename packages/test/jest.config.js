/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

module.exports = {
    moduleFileExtensions: ["ts", "js", "json", "node"],
    moduleNameMapper: {
        "@quatico/websmith-core": "<rootDir>/../core/src",
        "@quatico/websmith-compiler": "<rootDir>/../compiler/src",
    },
    prettierPath: null,
    roots: ["<rootDir>/src/"],
    testEnvironment: "node",
    testRegex: "src/.*(test|spec)\\.(js|ts)$",
    transform: {
        "^.+\\.(j|t)s$": [
            "@swc/jest",
            {
                jsc: {
                    parser: {
                        syntax: "typescript",
                    },
                },
            },
        ],
    },
};
