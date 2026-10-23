/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createProject, removeProject, runViteWatch, writeFile, writeProfiles, writeTsConfig } from "./vite-project";

const APP = { profile: "app" };
const VITES = ["vite", "vite6"];

// The source of an addon that replaces MARK_IN with `replacement` in every module
const replacerAddon = (replacement: string): string =>
    `exports.activate = ctx => ctx.registerProcessor((_f, c) => c.replaceAll("MARK_IN", ${JSON.stringify(replacement)}));\n`;

// A step of runViteWatch that writes `content` to `fileName` in the project directory
const writeStep = (fileName: string, content: string): string => `fs.writeFileSync(${JSON.stringify(fileName)}, ${JSON.stringify(content)});`;

const CONFIG_WITHOUT_ADDONS = JSON.stringify({ addonsDir: "./addons", profiles: { app: { addons: [] } } });

beforeEach(() => {
    createProject("vite-build-watch");

    writeTsConfig({});
    writeProfiles({ app: { addons: ["replacer"] } });
    writeFile("addons/replacer/addon.js", replacerAddon("MARK_OUT"));
    writeFile("src/main.ts", `import { b } from "./b";\nexport const greeting: string = "MARK_IN_main" + b;\n`);
    writeFile("src/b.ts", `export const b: string = "MARK_IN_b";\n`);
});

afterEach(() => {
    removeProject();
});

describe("vite build --watch w/ websmith", () => {
    it.each(VITES)(
        "should rebuild with edited addon w/ edit of addon file under watch w/ %s",
        vite => {
            const events = runViteWatch({
                vite,
                pluginOptions: APP,
                afterBuilds: [writeStep("addons/replacer/addon.js", replacerAddon("MARK_NEW"))],
            });
            const actual = events.at(-1);

            expect(events.filter(cur => cur.code === "START")).toHaveLength(2);
            expect(actual?.code).toBe("BUNDLE_END");
            expect(actual?.bundle).toContain("MARK_NEW_main");
            expect(actual?.bundle).toContain("MARK_NEW_b");
            expect(actual?.bundle).not.toContain("MARK_OUT");
        },
        90000
    );

    it.each(VITES)(
        "should drop output of removed addon from every module w/ config edit under watch w/ %s",
        vite => {
            const events = runViteWatch({ vite, pluginOptions: APP, afterBuilds: [writeStep("websmith.config.json", CONFIG_WITHOUT_ADDONS)] });
            const actual = events.at(-1);

            expect(actual?.code).toBe("BUNDLE_END");
            expect(actual?.bundle).toContain("MARK_IN_main");
            expect(actual?.bundle).toContain("MARK_IN_b");
            expect(actual?.bundle).not.toContain("MARK_OUT");
        },
        90000
    );

    it.each(VITES)(
        "should fail one rebuild and rebuild clean w/ broken config fixed under watch w/ %s",
        vite => {
            const events = runViteWatch({
                vite,
                pluginOptions: APP,
                afterBuilds: [writeStep("websmith.config.json", "{ broken"), writeStep("websmith.config.json", CONFIG_WITHOUT_ADDONS)],
            });
            const actual = events.at(-1);

            expect(events.filter(cur => cur.code === "ERROR")).toEqual([
                { code: "ERROR", hook: "buildStart", message: expect.stringContaining("Invalid JSON") },
            ]);
            expect(actual?.code).toBe("BUNDLE_END");
            expect(actual?.bundle).toContain("MARK_IN_main");
            expect(actual?.bundle).toContain("MARK_IN_b");
            expect(actual?.bundle).not.toContain("MARK_OUT");
        },
        90000
    );

    it.each(VITES)(
        "should rebuild only edited module w/ source edit under watch w/ %s",
        vite => {
            const events = runViteWatch({
                vite,
                pluginOptions: APP,
                afterBuilds: [writeStep("src/b.ts", `export const b: string = "MARK_IN_b2";\n`)],
            });
            const actual = events.at(-1);

            expect(actual?.code).toBe("BUNDLE_END");
            expect(actual?.bundle).toContain("MARK_OUT_b2");
            expect(actual?.bundle).toContain("MARK_OUT_main");
            expect(actual?.bundle).not.toContain("MARK_IN");
        },
        90000
    );
});
