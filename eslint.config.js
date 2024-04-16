const globals = require("globals");
const js = require("@eslint/js");
const ts = require("typescript-eslint");
const jest = require("eslint-plugin-jest");
const prettier = require("eslint-config-prettier");
const nxPlugin = require("@nx/eslint-plugin");
const jsoncParser = require("jsonc-eslint-parser");
const importPlugin = require("eslint-plugin-import");

module.exports = [
    js.configs.recommended,
    ...ts.configs.recommendedTypeChecked,
    jest.configs["flat/recommended"],
    prettier,
    {
        plugins: {
            "@nx": nxPlugin,
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
                project: true,
                tsconfigRootDir: __dirname,
                project: __dirname + "/tsconfig.lint.json",
                ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
            },
        },
        linterOptions: {
            reportUnusedDisableDirectives: true,
        },
        settings: {
            // "import/parsers": {
            //     espree: [".js", ".cjs", ".mjs", ".jsx", ".ts", ".tsx"],
            //     "@typescript-eslint/parser": [".ts"],
            // },
            // "import/resolver": {
            //     typescript: true,
            //     node: true,
            // },
            "import/resolver": {
                alias: {
                    map: [
                        ["@quatico/websmith-api", __dirname + "/packages/api/src"],
                        ["@quatico/websmith-compiler", __dirname + "/packages/compiler/src"],
                        ["@quatico/websmith-core", __dirname + "/packages/core/src"],
                        ["@quatico/websmith-webpack", __dirname + "/packages/webpack/src"],
                    ],
                    extensions: [".ts", ".js", ".jsx", ".json"],
                },
            },
        },
        rules: {
            ...jest.configs["flat/recommended"].rules,
            // ...importPlugin.configs["recommended"].rules,
            //     "import/no-cycle": ["error", { maxDepth: Infinity }],
            //     "@typescript-eslint/ban-ts-comment": "off",
            //     "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-var-requires": "warn",
            "arrow-parens": ["error", "as-needed"],
            "max-len": ["warn", { code: 150, tabWidth: 4 }],
            "no-console": "error",
            "prettier/prettier": "off",
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
