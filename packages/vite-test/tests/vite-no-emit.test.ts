/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import fs from "node:fs";
import path from "node:path";
import {
    createProject,
    getProjectDir,
    removeProject,
    runVite,
    runViteDev,
    writeConfig,
    writeFile,
    writeProfiles,
    writeTsConfig,
} from "./vite-project";

// The compilerOptions of create-vite's tsconfig.app.json, without types: ["vite/client"], which is not installed here;
// writeTsConfig's rootDir and outDir are dropped, as the template sets neither
const VITE_TEMPLATE_OPTIONS = {
    allowImportingTsExtensions: true,
    verbatimModuleSyntax: true,
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    rootDir: undefined,
    outDir: undefined,
};

// Both modules changed by the addon, none left unchanged
const BUNDLED_ADDON_OUTPUT = /^(?![\s\S]*MARK_IN)(?=[\s\S]*MARK_OUT main)(?=[\s\S]*MARK_OUT dep)/;

const REPLACER_ADDON = `exports.activate = ctx => ctx.registerProcessor((_f, c) => c.replaceAll("MARK_IN", "MARK_OUT"));\n`;

const SOURCES = ["src/dep.ts", "src/main.ts"];

beforeEach(() => {
    createProject("vite-no-emit");

    writeFile("addons/replacer/addon.js", REPLACER_ADDON);
    writeFile("src/main.ts", `import { dep } from "./dep.ts";\nexport const main: string = "MARK_IN main " + dep;\n`);
    writeFile("src/dep.ts", `export const dep: string = "MARK_IN dep";\n`);
    writeConfig({});
});

afterEach(() => {
    removeProject();
});

describe("vite w/ websmith plugin and noEmit", () => {
    it.each(["vite", "vite6"])(
        "should bundle module changed by processor addon w/ %s and vite template tsconfig",
        vite => {
            writeTsConfig(VITE_TEMPLATE_OPTIONS);

            const actual = runVite({ vite, pluginOptions: { profile: "app" } });

            expect(actual.error).toBeUndefined();
            expect(actual.warnings).toEqual([]);
            expect(actual.code).toMatch(BUNDLED_ADDON_OUTPUT);
            expect(listFiles("src")).toEqual(SOURCES);
        },
        60000
    );

    it.each(["vite", "vite6"])(
        "should serve module changed by processor addon in dev server w/ %s and vite template tsconfig",
        vite => {
            writeTsConfig(VITE_TEMPLATE_OPTIONS);

            const actual = runViteDev({ vite, pluginOptions: { profile: "app" }, steps: [`await get("/src/main.ts");`] });

            expect(actual.responses).toEqual([expect.objectContaining({ url: "/src/main.ts", status: 200 })]);
            expect(actual.responses[0].body).toContain("MARK_OUT main");
            expect(actual.responses[0].body).not.toContain("MARK_IN");
            expect(listFiles("src")).toEqual(SOURCES);
        },
        60000
    );

    it("should write no file beside the sources w/ vite template tsconfig and transpileOnly", () => {
        writeTsConfig(VITE_TEMPLATE_OPTIONS);

        const actual = runVite({ pluginOptions: { profile: "app", transpileOnly: true } });

        expect(actual.code).toMatch(BUNDLED_ADDON_OUTPUT);
        expect(listFiles("src")).toEqual(SOURCES);
    }, 60000);

    it("should write no file beside the sources w/ vite template tsconfig and addon w/o type information", () => {
        writeTsConfig(VITE_TEMPLATE_OPTIONS);
        writeFile("addons/replacer/addon.js", `${REPLACER_ADDON}exports.needsTypeInfo = false;\n`);

        const actual = runVite({ pluginOptions: { profile: "app" } });

        expect(actual.code).toMatch(BUNDLED_ADDON_OUTPUT);
        expect(listFiles("src")).toEqual(SOURCES);
    }, 60000);

    it("should bundle module changed by processor addon w/ noEmit inherited through extends", () => {
        writeFile("tsconfig.base.json", JSON.stringify({ compilerOptions: { noEmit: true } }));
        writeFile(
            "tsconfig.json",
            JSON.stringify({
                extends: "./tsconfig.base.json",
                compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", allowImportingTsExtensions: true },
            })
        );

        const actual = runVite({ pluginOptions: { profile: "app" } });

        expect(actual.code).toMatch(BUNDLED_ADDON_OUTPUT);
        expect(listFiles("src")).toEqual(SOURCES);
    }, 60000);

    it("should bundle module changed by processor addon and write declarations beside the sources w/ emitDeclarationOnly and declaration", () => {
        writeTsConfig({ ...VITE_TEMPLATE_OPTIONS, noEmit: undefined, emitDeclarationOnly: true, declaration: true });

        const actual = runVite({ pluginOptions: { profile: "app" } });

        expect(actual.code).toMatch(BUNDLED_ADDON_OUTPUT);
        expect(listFiles("src")).toEqual(["src/dep.d.ts", "src/dep.ts", "src/main.d.ts", "src/main.ts"]);
    }, 60000);

    it("should bundle module changed by processor addon and write no file beside the sources w/ emitDeclarationOnly, declaration and transpileOnly", () => {
        writeTsConfig({ ...VITE_TEMPLATE_OPTIONS, noEmit: undefined, emitDeclarationOnly: true, declaration: true });

        const actual = runVite({ pluginOptions: { profile: "app", transpileOnly: true } });

        expect(actual.code).toMatch(BUNDLED_ADDON_OUTPUT);
        expect(listFiles("src")).toEqual(SOURCES);
    }, 60000);

    it("should keep writing the dependent profile's output w/ noEmit in the bundled profile", () => {
        writeTsConfig(VITE_TEMPLATE_OPTIONS);
        writeFile("addons/depmark/addon.js", `exports.activate = ctx => ctx.registerProcessor((_f, c) => c.replaceAll("MARK_IN", "MARK_DEP"));\n`);
        writeProfiles({
            app: { addons: ["replacer"], depends: ["lib"], tsConfig: { noEmit: true } },
            lib: { addons: ["depmark"], tsConfig: { noEmit: false, allowImportingTsExtensions: false, outDir: "./lib-out", rootDir: "./src" } },
        });

        const actual = runVite({ pluginOptions: { profile: "app" } });

        expect(actual.code).toMatch(BUNDLED_ADDON_OUTPUT);
        expect(fs.readFileSync(path.join(getProjectDir(), "lib-out", "main.js"), "utf-8")).toContain("MARK_DEP main");
    }, 60000);

    it("should bundle module changed by processor addon w/ profile noEmit false and outDir", () => {
        writeTsConfig(VITE_TEMPLATE_OPTIONS);
        writeConfig({ noEmit: false, outDir: "./websmith-out", rootDir: "." });

        const actual = runVite({ pluginOptions: { profile: "app" } });

        expect(actual.code).toMatch(BUNDLED_ADDON_OUTPUT);
        expect(fs.existsSync(path.join(getProjectDir(), "websmith-out", "src", "main.js"))).toBe(true);
    }, 60000);
});

// The files under the project directory `dir`, relative to the project, with forward slashes
const listFiles = (dir: string): string[] =>
    fs
        .readdirSync(path.join(getProjectDir(), dir), { recursive: true, withFileTypes: true })
        .flatMap(cur => (cur.isFile() ? [path.relative(getProjectDir(), path.join(cur.parentPath, cur.name)).split(path.sep).join("/")] : []))
        .sort();
