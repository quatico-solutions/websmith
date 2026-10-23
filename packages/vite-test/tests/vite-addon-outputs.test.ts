/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import fs from "node:fs";
import path from "node:path";
import { createProject, getProjectDir, removeProject, runVite, runViteWatch, writeFile, writeProfiles, writeTsConfig } from "./vite-project";

const APP = { profile: "app" };
const VITES = ["vite", "vite6"];

// A CommonJS addon whose generator runs `body` with the context as `ctx` and the module as `file`, for main.ts only
const writeGeneratorAddon = (name: string, body: string): void =>
    writeFile(
        `addons/${name}/addon.js`,
        `exports.activate = ctx => ctx.registerGenerator(file => {\n    if (!file.endsWith("main.ts")) return;\n    ${body}\n});\n`
    );

const projectPath = (fileName: string): string => path.join(getProjectDir(), fileName);

beforeEach(() => {
    createProject("vite-addon-outputs");

    writeTsConfig({});
    writeFile("addons/replacer/addon.js", `exports.activate = ctx => ctx.registerProcessor((_f, c) => c.replaceAll("MARK_IN", "MARK_OUT"));\n`);
    writeFile("src/main.ts", `import { b } from "./b";\nexport const greeting: string = "MARK_IN" + b;\n`);
    writeFile("src/b.ts", `export const b: string = "B";\n`);
});

afterEach(() => {
    removeProject();
});

describe("vite build w/ websmith addon outputs", () => {
    it.each(VITES)(
        "should write generator output to disk only w/ %s",
        vite => {
            writeGeneratorAddon("gen", `ctx.getSystem().writeFile(ctx.resolvePath("gen/generated.txt"), "GENERATED_TEXT");`);
            writeProfiles({ app: { addons: ["replacer", "gen"] } });

            const { code, assets, error } = runVite({ vite, pluginOptions: APP });
            const actual = fs.readFileSync(projectPath("gen/generated.txt"), "utf-8");

            expect(error).toBeUndefined();
            expect(actual).toBe("GENERATED_TEXT");
            expect(code).not.toContain("GENERATED_TEXT");
            expect(assets.filter(cur => cur.source.includes("GENERATED_TEXT"))).toEqual([]);
        },
        60000
    );

    it.each(VITES)(
        "should watch asset dependency and input file of generator w/ %s",
        vite => {
            writeFile("templates/t.html", "<p>template</p>\n");
            writeFile("src/extra.ts", `export const extra = 1;\n`);
            writeGeneratorAddon(
                "deps",
                `ctx.addAssetDependency(ctx.resolvePath("templates/t.html"), file);\n    ctx.addInputFile(ctx.resolvePath("src/extra.ts"));`
            );
            writeProfiles({ app: { addons: ["replacer", "deps"] } });

            const { watchFiles, error } = runVite({ vite, pluginOptions: APP, probe: true });

            expect(error).toBeUndefined();
            expect(watchFiles).toEqual(expect.arrayContaining(["templates/t.html", "src/extra.ts"]));
        },
        60000
    );

    it("should rebuild w/ edit of asset dependency under watch", () => {
        writeFile("templates/t.html", "<p>template</p>\n");
        writeGeneratorAddon("deps", `ctx.addAssetDependency(ctx.resolvePath("templates/t.html"), file);`);
        writeProfiles({ app: { addons: ["replacer", "deps"] } });

        const actual = runViteWatch({
            pluginOptions: APP,
            afterBuilds: [`fs.writeFileSync(${JSON.stringify(projectPath("templates/t.html"))}, "<p>changed</p>\\n");`],
        }).map(cur => cur.code);

        expect(actual.filter(cur => cur === "START")).toHaveLength(2);
        expect(actual[actual.length - 1]).toBe("BUNDLE_END");
    }, 60000);

    it.each(VITES)(
        "should bundle new processor output w/ edit of asset dependency under watch w/ %s",
        vite => {
            writeFile("data.txt", "DATA1");
            writeFile(
                "addons/datap/addon.js",
                `const fs = require("fs");\nexports.activate = ctx => ctx.registerProcessor((file, content) => (ctx.addAssetDependency(ctx.resolvePath("data.txt"), file), content.replaceAll("DATA_IN", fs.readFileSync(ctx.resolvePath("data.txt"), "utf-8"))));\n`
            );
            writeFile("src/main.ts", `export const greeting: string = "DATA_IN";\n`);
            writeProfiles({ app: { addons: ["datap"] } });

            const actual = runViteWatch({
                vite,
                pluginOptions: APP,
                afterBuilds: [`fs.writeFileSync(${JSON.stringify(projectPath("data.txt"))}, "DATA2");`],
            })
                .filter(cur => cur.code === "BUNDLE_END")
                .map(cur => cur.bundle?.match(/DATA\d/)?.[0]);

            expect(actual).toEqual(["DATA1", "DATA2"]);
        },
        60000
    );

    it("should bundle virtual file added on activation w/ rebuild under watch", () => {
        writeFile("addons/activation/addon.js", `exports.activate = ctx => ctx.addVirtualFile("activation.json", '{"activation":true}');\n`);
        writeProfiles({ app: { addons: ["replacer", "activation"] } });
        const virtualFile = projectPath("dist/activation.json");

        const events = runViteWatch({
            pluginOptions: APP,
            afterBuilds: [
                `fs.rmSync(${JSON.stringify(virtualFile)}, { force: true }); fs.writeFileSync(${JSON.stringify(projectPath("src/b.ts"))}, "export const b: string = \\"C\\";\\n");`,
            ],
        }).map(cur => cur.code);
        const actual = fs.readFileSync(virtualFile, "utf-8");

        expect(events.filter(cur => cur === "START")).toHaveLength(2);
        expect(events[events.length - 1]).toBe("BUNDLE_END");
        expect(actual).toBe('{"activation":true}');
    }, 60000);

    it("should rebuild w/ edit of asset dependency added on activation after rebuild under watch", () => {
        writeFile("templates/t.html", "<p>template</p>\n");
        writeFile(
            "addons/activation/addon.js",
            `exports.activate = ctx => ctx.addAssetDependency(ctx.resolvePath("templates/t.html"), ctx.resolvePath("src/main.ts"));\n`
        );
        writeProfiles({ app: { addons: ["replacer", "activation"] } });

        const actual = runViteWatch({
            pluginOptions: APP,
            afterBuilds: [
                `fs.writeFileSync(${JSON.stringify(projectPath("src/b.ts"))}, "export const b: string = \\"C\\";\\n");`,
                `fs.writeFileSync(${JSON.stringify(projectPath("templates/t.html"))}, "<p>changed</p>\\n");`,
            ],
        }).map(cur => cur.code);

        expect(actual.filter(cur => cur === "START")).toHaveLength(3);
        expect(actual[actual.length - 1]).toBe("BUNDLE_END");
    }, 60000);

    it.each(VITES)(
        "should run result processor once w/ outputs of both modules w/ %s",
        vite => {
            writeFile(
                "addons/results/addon.js",
                `const fs = require("node:fs");\nconst path = require("node:path");\nexports.activate = ctx => ctx.registerResultProcessor(files => fs.appendFileSync(ctx.resolvePath("results.log"), JSON.stringify(files.map(cur => path.basename(cur))) + "\\n"));\n`
            );
            writeProfiles({ app: { addons: ["replacer", "results"] } });

            const { error } = runVite({ vite, pluginOptions: APP });
            const actual = fs.readFileSync(projectPath("results.log"), "utf-8").trim().split("\n");

            expect(error).toBeUndefined();
            expect(actual).toHaveLength(1);
            expect(JSON.parse(actual[0])).toEqual(expect.arrayContaining(["main.js", "b.js"]));
        },
        60000
    );

    it.each(VITES)(
        "should write dependent profile to its outDir and bundle the profile's output w/ %s",
        vite => {
            writeFile(
                "addons/depmark/addon.js",
                `exports.activate = ctx => ctx.registerProcessor((_f, c) => c.replaceAll("MARK_IN", "DEP_MARK"));\n`
            );
            writeProfiles({
                app: { addons: ["replacer"], depends: ["dep"], tsConfig: { outDir: "./app-out" } },
                dep: { addons: ["depmark"], tsConfig: { outDir: "./dep-out" } },
            });

            const { code, error } = runVite({ vite, pluginOptions: APP });

            expect(error).toBeUndefined();
            expect(fs.readFileSync(projectPath("dep-out/main.js"), "utf-8")).toContain("DEP_MARK");
            expect(fs.existsSync(projectPath("dep-out/b.js"))).toBe(true);
            expect(code).toContain("MARK_OUT");
            expect(code).not.toContain("DEP_MARK");
        },
        60000
    );

    it.each(VITES)(
        "should not rewrite unchanged dependent output w/ second build of same plugin w/ %s",
        vite => {
            writeProfiles({
                app: { addons: ["replacer"], depends: ["dep"], tsConfig: { outDir: "./app-out" } },
                dep: { tsConfig: { outDir: "./dep-out" } },
            });
            const past = new Date(2000, 0, 1);

            const { error } = runVite({
                vite,
                pluginOptions: APP,
                betweenBuilds: `fs.utimesSync(${JSON.stringify(projectPath("dep-out/main.js"))}, ${past.getTime() / 1000}, ${past.getTime() / 1000});`,
            });
            const actual = fs.statSync(projectPath("dep-out/main.js")).mtime.getTime();

            expect(error).toBeUndefined();
            expect(actual).toBe(past.getTime());
        },
        60000
    );

    it.each(VITES)(
        "should bundle virtual file as asset w/ %s",
        vite => {
            writeGeneratorAddon("virtual", `ctx.addVirtualFile("virtual.json", '{"virtual":true}');`);
            writeProfiles({ app: { addons: ["replacer", "virtual"] } });

            const { assets, error } = runVite({ vite, pluginOptions: APP });

            expect(error).toBeUndefined();
            expect(assets).toContainEqual({ fileName: "virtual.json", source: '{"virtual":true}' });
        },
        60000
    );

    it.each(VITES)(
        "should bundle virtual file as asset w/ absolute path in outDir w/ %s",
        vite => {
            writeGeneratorAddon("virtual", `ctx.addVirtualFile(ctx.resolvePath("dist/nested/v.txt"), "NESTED");`);
            writeProfiles({ app: { addons: ["replacer", "virtual"] } });

            const { assets, error } = runVite({ vite, pluginOptions: APP });

            expect(error).toBeUndefined();
            expect(assets).toContainEqual({ fileName: "nested/v.txt", source: "NESTED" });
        },
        60000
    );

    it.each(VITES)(
        "should bundle virtual file of result processor as asset w/ %s",
        vite => {
            writeFile(
                "addons/results/addon.js",
                `exports.activate = ctx => ctx.registerResultProcessor(() => ctx.addVirtualFile("result.txt", "RESULT"));\n`
            );
            writeProfiles({ app: { addons: ["replacer", "results"] } });

            const { assets, error } = runVite({ vite, pluginOptions: APP });

            expect(error).toBeUndefined();
            expect(assets).toContainEqual({ fileName: "result.txt", source: "RESULT" });
        },
        60000
    );

    it.each(VITES)(
        "should delete css asset of vite from bundle w/ removeOutputFile w/ %s",
        vite => {
            writeFile("src/style.css", ".a { color: red; }\n");
            writeFile("src/main.ts", `import "./style.css";\nexport const greeting: string = "MARK_IN";\n`);
            writeProfiles({ app: { addons: ["replacer"] } });
            const cssName = runVite({ vite, pluginOptions: APP }).assets.find(cur => cur.fileName.endsWith(".css"))?.fileName;
            writeGeneratorAddon("remover", `ctx.removeOutputFile(${JSON.stringify(cssName)});`);
            writeProfiles({ app: { addons: ["replacer", "remover"] } });

            const { assets, error, warnings } = runVite({ vite, pluginOptions: APP });
            const actual = assets.map(cur => cur.fileName);

            expect(cssName).toBeDefined();
            expect(error).toBeUndefined();
            expect(warnings).toEqual([]);
            expect(actual).not.toContain(cssName);
        },
        90000
    );

    it.each(VITES)(
        "should fail w/ virtual file outside outDir w/ %s",
        vite => {
            writeGeneratorAddon("outside", `ctx.addVirtualFile(ctx.resolvePath("src/virtual.ts"), "export const v = 1;");`);
            writeProfiles({ app: { addons: ["replacer", "outside"] } });

            const { error } = runVite({ vite, pluginOptions: APP });
            const actual = error?.message;

            expect(actual).toContain("addVirtualFile");
            expect(actual).toContain('"outside"');
            expect(actual).toContain("outside build.outDir");
        },
        60000
    );

    it.each(VITES)(
        "should pass with one warning w/ removal of absent file w/ %s",
        vite => {
            writeGeneratorAddon("remover", `ctx.removeOutputFile("absent.js");`);
            writeProfiles({ app: { addons: ["replacer", "remover"] } });

            const { error, warnings } = runVite({ vite, pluginOptions: APP });
            const actual = warnings.filter(cur => cur.includes('removeOutputFile of addon "remover"'));

            expect(error).toBeUndefined();
            expect(actual).toHaveLength(1);
        },
        60000
    );
});
