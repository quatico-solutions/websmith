/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
const globals = require("globals");
const js = require("@eslint/js");
const ts = require("typescript-eslint");
const jest = require("eslint-plugin-jest");
const prettier = require("eslint-config-prettier");
const nxPlugin = require("@nx/eslint-plugin");
// TODO: Enable the import when eslint-plugin-import supports FlatESLint
// const importPlugin = require("eslint-plugin-import");

module.exports = [
    js.configs.recommended,
    ...ts.configs.recommendedTypeChecked,
    jest.configs["flat/recommended"],
    prettier,
    {
        plugins: {
            "@nx": nxPlugin,
            // TODO: Enable the following plugin when eslint-plugin-import supports FlatESLint
            // import: importPlugin,
        },
    },
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.js"],
        languageOptions: {
            globals: {
                ...globals.node,
            },
            parserOptions: {
                tsconfigRootDir: __dirname,
                project: __dirname + "/tsconfig.lint.json",
                ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
            },
        },
        linterOptions: {
            reportUnusedDisableDirectives: true,
        },
        settings: {
            "import/parsers": {
                espree: [".js", ".cjs", ".mjs", ".jsx"],
                "@typescript-eslint/parser": [".ts", ".tsx"],
            },
            "import/resolver": {
                typescript: true,
                node: true,
                alias: {
                    map: [
                        ["@quatico/websmith-api", __dirname + "/packages/api/src"],
                        ["@quatico/websmith-compiler", __dirname + "/packages/compiler/src"],
                        ["@quatico/websmith-core", __dirname + "/packages/core/src"],
                        ["@quatico/websmith-testing", __dirname + "/packages/testing/src"],
                        ["@quatico/websmith-webpack", __dirname + "/packages/webpack/src"],
                    ],
                    extensions: [".ts", ".js", ".jsx", ".json"],
                },
            },
        },
        rules: {
            ...jest.configs["flat/recommended"].rules,
            // TODO: Enable the following rules when eslint-plugin-import supports FlatESLint
            // ...importPlugin.configs["recommended"].rules,
            "@typescript-eslint/no-unsafe-call": "warn",
            "@typescript-eslint/no-unsafe-argument": "warn",
            "@typescript-eslint/no-unsafe-assignment": "warn",
            "@typescript-eslint/no-unsafe-member-access": "warn",
            "@typescript-eslint/no-unsafe-return": "warn",
            "@typescript-eslint/unbound-method": "warn",
            "@typescript-eslint/no-var-requires": "warn",
            "arrow-parens": ["error", "as-needed"],
            "max-len": ["warn", { code: 150, tabWidth: 4 }],
            curly: "error",
        },
    },
    {
        files: ["**/*.test.js", "**/*.test.ts", "**/*.spec.ts"],
        languageOptions: {
            globals: {
                ...globals.jest,
            },
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "max-len": "off",
        },
    },
];
