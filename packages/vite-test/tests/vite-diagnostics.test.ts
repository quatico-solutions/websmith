/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createProject, removeProject, runVite, runViteWatch, writeConfig, writeFile, writeProfiles, writeTsConfig } from "./vite-project";

const APP = { profile: "app" };

const countOf = (text: string | undefined, part: string): number => (text?.split(part).length ?? 1) - 1;

// TS4094 under declaration: true, like the loader's dependent profile e2e
const DECLARATION_ERROR_SOURCE = `export const C = class { private p = 1; };\n`;
const DECLARATION_ERROR = "may not be private or protected";

beforeEach(() => {
    createProject("vite-diagnostics");

    writeTsConfig({});
    writeFile("addons/replacer/addon.js", `exports.activate = ctx => ctx.registerProcessor((_f, c) => c.replaceAll("MARK_IN", "MARK_OUT"));\n`);
    writeFile("src/main.ts", `export const greeting: string = "MARK_IN";\n`);
});

afterEach(() => {
    removeProject();
});

describe("vite build w/ websmith diagnostics", () => {
    it.each(["vite", "vite6"])(
        "should fail w/ syntax error and its position w/ %s",
        vite => {
            writeConfig({});
            writeFile("src/main.ts", `// The next line is not valid TypeScript\nexport const x = ;\n`);

            const { error } = runVite({ vite, pluginOptions: APP });
            const actual1 = error?.message;
            const actual2 = error?.loc?.line;

            expect(actual1).toContain("Expression expected");
            expect(actual2).toBe(2);
        },
        60000
    );

    it("should fail w/ esm error of dependent profile and its position", () => {
        writeProfiles({
            dep: { esm: { runtime: "node" }, tsConfig: { outDir: "./dep-out" } },
            app: { addons: ["replacer"], depends: ["dep"], tsConfig: { outDir: "./app-out" } },
        });
        writeFile("src/b.ts", `export const b = 1;\n`);
        writeFile("src/main.ts", `import { b } from "./b";\nexport const x = b;\n`);

        const { error } = runVite({ pluginOptions: APP });
        const actual1 = error?.message;
        const actual2 = error?.loc;

        expect(actual1).toMatch(/ESM91010[\s\S]*profile "dep"/);
        expect(actual2).toBeDefined();
    }, 60000);

    it.each(["vite", "vite6"])(
        "should fail once in transform w/ declaration error only in dependent profile w/ %s",
        vite => {
            writeProfiles({
                app: { depends: ["dep"], tsConfig: { declaration: false, outDir: "./app-out" } },
                dep: { tsConfig: { declaration: true, outDir: "./dep-out" } },
            });
            writeFile("src/main.ts", DECLARATION_ERROR_SOURCE);

            const { error } = runVite({ vite, pluginOptions: APP });
            const actual1 = error?.message;
            const actual2 = countOf(error?.message, DECLARATION_ERROR);
            const actual3 = error?.hook;
            const actual4 = error?.loc?.file;

            expect(actual1).toMatch(/\(profile "dep"\)$/m);
            expect(actual2).toBe(1);
            expect(actual3).toBe("transform");
            expect(actual4).toMatch(/src[\\/]main\.ts$/);
        },
        60000
    );

    it.each(["vite", "vite6"])(
        "should fail once without profile label w/ declaration error in target and dependent profile w/ %s",
        vite => {
            writeProfiles({
                app: { depends: ["dep"], tsConfig: { declaration: true, outDir: "./app-out" } },
                dep: { tsConfig: { declaration: true, outDir: "./dep-out" } },
            });
            writeFile("src/main.ts", DECLARATION_ERROR_SOURCE);

            const { error } = runVite({ vite, pluginOptions: APP });
            const actual1 = countOf(error?.message, DECLARATION_ERROR);
            const actual2 = error?.message;

            expect(actual1).toBe(1);
            expect(actual2).not.toContain("(profile");
        },
        60000
    );

    it("should fail w/ throwing processor", () => {
        writeFile("addons/thrower/addon.js", `exports.activate = ctx => ctx.registerProcessor(() => { throw new Error("BOOM_PROCESSOR"); });\n`);
        writeProfiles({ app: { addons: ["thrower"] } });

        const actual = runVite({ pluginOptions: APP }).error?.message;

        expect(actual).toMatch(/Error in processor[\s\S]*BOOM_PROCESSOR/);
    }, 60000);

    it("should fail in buildStart w/ throwing activate", () => {
        writeFile("addons/activator/addon.js", `exports.activate = () => { throw new Error("BOOM_ACTIVATE"); };\n`);
        writeProfiles({ app: { addons: ["activator"] } });

        const { error } = runVite({ pluginOptions: APP });
        const actual1 = error?.message;
        const actual2 = error?.hook;

        expect(actual1).toMatch(/Error activating addon[\s\S]*BOOM_ACTIVATE/);
        expect(actual2).toBe("buildStart");
    }, 60000);

    it("should fail once in buildStart w/ missing depends target", () => {
        writeProfiles({ app: { addons: ["replacer"], depends: ["missing"] } });
        writeFile("src/b.ts", `export const b = 1;\n`);
        writeFile("src/main.ts", `import { b } from "./b";\nexport const x = b;\n`);

        const { error } = runVite({ pluginOptions: APP });
        const actual1 = countOf(error?.message, "Unknown profile 'missing'");
        const actual2 = error?.hook;

        expect(actual1).toBe(1);
        expect(actual2).toBe("buildStart");
    }, 60000);

    it("should fail once in buildStart w/ unconfigured profile", () => {
        writeConfig({});
        writeFile("src/b.ts", `export const b = 1;\n`);
        writeFile("src/main.ts", `import { b } from "./b";\nexport const x = b;\n`);

        const { error } = runVite({ pluginOptions: { profile: "nope" } });
        const actual1 = countOf(error?.message, "Profile 'nope' is not configured");
        const actual2 = error?.hook;

        expect(actual1).toBe(1);
        expect(actual2).toBe("buildStart");
    }, 60000);

    it("should fail w/ esm finding and its position under bundler runtime", () => {
        writeProfiles({ app: { addons: ["replacer"], esm: { runtime: "bundler" } } });
        writeFile("src/main.ts", `declare const require: (id: string) => unknown;\nexport const x = require("./x");\n`);

        const { error } = runVite({ pluginOptions: APP });
        const actual1 = error?.message;
        const actual2 = error?.loc;

        expect(actual1).toContain("ESM91001");
        expect(actual2).toBeDefined();
    }, 60000);

    it.each(["vite", "vite6"])(
        "should pass with warning w/ esm finding and check warn w/ %s",
        vite => {
            writeProfiles({ app: { addons: ["replacer"], esm: { runtime: "bundler", check: "warn" } } });
            writeFile("src/main.ts", `declare const require: (id: string) => unknown;\nexport const x = require("./x");\n`);

            const { error, warnings } = runVite({ vite, pluginOptions: APP });
            const actual1 = error;
            const actual2 = warnings.filter(cur => cur.includes("ESM91001"));

            expect(actual1).toBeUndefined();
            expect(actual2).toHaveLength(1);
        },
        60000
    );

    it("should fail in buildStart w/ profile emitting commonjs", () => {
        writeProfiles({ app: { addons: ["replacer"], tsConfig: { module: "commonjs", moduleResolution: "node10" } } });

        const { error } = runVite({ pluginOptions: APP });
        const actual1 = error?.message;
        const actual2 = error?.hook;

        expect(actual1).toMatch(/Profile 'app'[\s\S]*commonjs/);
        expect(actual2).toBe("buildStart");
    }, 60000);

    it("should pass with warning w/ addon warning through reporter", () => {
        writeFile(
            "addons/warner/addon.js",
            `const ts = require("typescript");
            exports.activate = ctx => ctx.registerProcessor((_f, c) => {
                ctx.getReporter().reportDiagnostic({ category: ts.DiagnosticCategory.Warning, code: 0, messageText: "ADDON_WARNING" });
                return c;
            });\n`
        );
        writeProfiles({ app: { addons: ["warner"] } });

        const { error, warnings } = runVite({ pluginOptions: APP });
        const actual1 = error;
        const actual2 = warnings.filter(cur => cur.includes("ADDON_WARNING"));

        expect(actual1).toBeUndefined();
        expect(actual2).toHaveLength(1);
    }, 60000);

    it("should warn once w/ missing addon and two modules", () => {
        writeProfiles({ app: { addons: ["replacer", "nope"] } });
        writeFile("src/b.ts", `export const b = 1;\n`);
        writeFile("src/main.ts", `import { b } from "./b";\nexport const x = b;\n`);

        const { error, warnings } = runVite({ pluginOptions: APP });
        const actual1 = error;
        const actual2 = warnings.filter(cur => cur.includes('"nope"'));

        expect(actual1).toBeUndefined();
        expect(actual2).toHaveLength(1);
    }, 60000);

    it("should report broken config w/ watch rebuild after config change", () => {
        writeConfig({});
        const brokenConfig = JSON.stringify({ addonsDir: "./addons", profiles: { app: { addons: ["replacer"], depends: ["missing"] } } });

        const events = runViteWatch({ pluginOptions: APP, afterFirstBuild: `fs.writeFileSync("websmith.config.json", ${JSON.stringify(brokenConfig)});` });
        const actual = events.filter(cur => cur.code === "ERROR").map(cur => cur.message);

        expect(actual).toEqual([expect.stringContaining("Unknown profile 'missing'")]);
    }, 90000);
});
