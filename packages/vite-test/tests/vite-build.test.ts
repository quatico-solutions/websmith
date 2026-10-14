/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createProject, removeProject, runViteBuild, writeConfig, writeFile, writeTsConfig } from "./vite-project";

// TS5053 prefix: jsxFactory excludes reactNamespace, an option error TypeScript 5 and 6 report without a file
const OPTION_ERROR = "Option 'reactNamespace' cannot be specified with option 'jsxFactory'";

beforeEach(() => {
    createProject("vite-build");

    writeTsConfig({});
    writeFile("addons/replacer/addon.js", `exports.activate = ctx => ctx.registerProcessor((_f, c) => c.replaceAll("MARK_IN", "MARK_OUT"));\n`);
    writeFile("src/env.d.ts", `declare module "*?raw" {\n    const text: string;\n    export default text;\n}\n`);
});

afterEach(() => {
    removeProject();
});

describe("vite build w/ websmith plugin", () => {
    it.each(["vite", "vite6"])(
        "should bundle module changed by processor addon w/ %s",
        vite => {
            writeConfig({});
            writeFile("src/main.ts", `export const greeting: string = "MARK_IN";\n`);

            const actual = runViteBuild({ vite, pluginOptions: { profile: "app" } });

            expect(actual).toContain("MARK_OUT");
            expect(actual).not.toContain("MARK_IN");
        },
        60000
    );

    it("should bundle tsx module w/ jsx of vite's own jsx handling", () => {
        writeTsxFixture();

        const actual = runViteBuild({ pluginOptions: { profile: "app", transpileOnly: true }, viteOptions: { esbuild: { jsxFactory: "h" } } });

        expect(actual).toMatch(/h\("div", \{ id: "MARK_OUT" \}\)/);
    }, 60000);

    it("should bundle tsx module w/o react jsx runtime of profile tsConfig", () => {
        writeTsxFixture();

        const actual = runViteBuild({ pluginOptions: { profile: "app", transpileOnly: true }, viteOptions: { esbuild: { jsxFactory: "h" } } });

        expect(actual).not.toContain("react/jsx-runtime");
    }, 60000);

    it("should bundle raw import untouched w/ ?raw query and unanchored include", () => {
        writeConfig({});
        writeFile("src/data.ts", `export const data: string = "MARK_IN";\n`);
        writeFile("src/main.ts", `import data from "./data.ts?raw";\nexport const raw = data;\n`);

        const actual = runViteBuild({ pluginOptions: { profile: "app", include: /\.ts/ } });

        expect(actual).toContain(`export const data: string = "MARK_IN";`);
    }, 60000);

    it("should bundle module changed by processor addon w/ include relative to root other than cwd", () => {
        writeConfig({});
        writeFile("src/main.ts", `export const greeting: string = "MARK_IN";\n`);

        const actual = runViteBuild({ pluginOptions: { profile: "app", include: "src/**/*.ts" }, cwd: __dirname });

        expect(actual).toContain("MARK_OUT");
    }, 60000);

    it("should bundle module unchanged w/ exclude relative to root other than cwd", () => {
        writeConfig({});
        writeFile("src/main.ts", `export const greeting: string = "MARK_IN";\n`);

        const actual = runViteBuild({ pluginOptions: { profile: "app", exclude: "src/**" }, cwd: __dirname });

        expect(actual).toContain("MARK_IN");
    }, 60000);

    it("should fail w/ option error of tsconfig", () => {
        writeTsConfig({ jsx: "react", jsxFactory: "h", reactNamespace: "R" });
        writeConfig({});
        writeFile("src/main.ts", `export const greeting: string = "MARK_IN";\n`);

        const actual = () => runViteBuild({ pluginOptions: { profile: "app", transpileOnly: true } });

        expect(actual).toThrow(OPTION_ERROR);
    }, 60000);
});

const writeTsxFixture = (): void => {
    writeConfig({ jsx: "react-jsx" });
    writeFile("src/view.tsx", `const h = (tag: string, props: unknown) => ({ tag, props });\nexport const view = <div id="MARK_IN" />;\n`);
    writeFile("src/main.ts", `export { view } from "./view";\n`);
};
