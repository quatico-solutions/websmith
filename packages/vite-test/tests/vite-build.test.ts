/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Vite is ESM only, so it runs in a separate Node process that imports the plugin by its package name
const getProjectDir = (): string => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    return path.resolve(__dirname, "..", `test-output-vite-build-${testId}_${Date.now()}`);
};

// TS5053 prefix: jsxFactory excludes reactNamespace, an option error TypeScript 5 and 6 report without a file
const OPTION_ERROR = "Option 'reactNamespace' cannot be specified with option 'jsxFactory'";

let projectDir: string;

beforeEach(() => {
    projectDir = getProjectDir();

    writeTsConfig({});
    writeFile("addons/replacer/addon.js", `exports.activate = ctx => ctx.registerProcessor((_f, c) => c.replaceAll("MARK_IN", "MARK_OUT"));\n`);
    writeFile("src/env.d.ts", `declare module "*?raw" {\n    const text: string;\n    export default text;\n}\n`);
});

afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
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

    it("should bundle raw import untouched w/ ?raw query", () => {
        writeConfig({});
        writeFile("src/data.ts", `export const data: string = "MARK_IN";\n`);
        writeFile("src/main.ts", `import data from "./data.ts?raw";\nexport const raw = data;\n`);

        const actual = runViteBuild({ pluginOptions: { profile: "app" } });

        expect(actual).toContain(`export const data: string = "MARK_IN";`);
    }, 60000);

    it("should fail w/ option error of tsconfig", () => {
        writeTsConfig({ jsx: "react", jsxFactory: "h", reactNamespace: "R" });
        writeConfig({});
        writeFile("src/main.ts", `export const greeting: string = "MARK_IN";\n`);

        const actual = () => runViteBuild({ pluginOptions: { profile: "app", transpileOnly: true } });

        expect(actual).toThrow(OPTION_ERROR);
    }, 60000);
});

const writeFile = (fileName: string, content: string): void => {
    const filePath = path.join(projectDir, fileName);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, { encoding: "utf-8" });
};

const writeTsConfig = (compilerOptions: Record<string, unknown>): void =>
    writeFile(
        "tsconfig.json",
        JSON.stringify({
            compilerOptions: {
                target: "ES2022",
                module: "ESNext",
                moduleResolution: "bundler",
                rootDir: "./src",
                outDir: "./tsc-out",
                ...compilerOptions,
            },
        })
    );

const writeConfig = (tsConfig: Record<string, unknown>): void =>
    writeFile("websmith.config.json", JSON.stringify({ addonsDir: "./addons", profiles: { app: { addons: ["replacer"], tsConfig } } }));

const writeTsxFixture = (): void => {
    writeConfig({ jsx: "react-jsx" });
    writeFile("src/view.tsx", `const h = (tag: string, props: unknown) => ({ tag, props });\nexport const view = <div id="MARK_IN" />;\n`);
    writeFile("src/main.ts", `export { view } from "./view";\n`);
};

const runViteBuild = ({
    vite = "vite",
    pluginOptions,
    viteOptions = {},
}: {
    vite?: string;
    pluginOptions: Record<string, unknown>;
    viteOptions?: Record<string, unknown>;
}): string => {
    writeFile(
        "build.mjs",
        `
        import { build } from ${JSON.stringify(vite)};
        import websmith from "@quatico/websmith-vite";

        const result = await build({
            root: ${JSON.stringify(projectDir)},
            configFile: false,
            logLevel: "warn",
            plugins: [websmith(${JSON.stringify(pluginOptions)})],
            ...${JSON.stringify(viteOptions)},
            build: { write: false, minify: false, lib: { entry: "src/main.ts", formats: ["es"] } },
        });
        const outputs = (Array.isArray(result) ? result : [result]).flatMap(cur => cur.output);
        console.log(JSON.stringify(outputs.filter(cur => cur.type === "chunk").map(cur => cur.code).join("\\n")));
        `
    );
    const { status, stdout, stderr } = spawnSync(process.execPath, ["build.mjs"], { cwd: projectDir, encoding: "utf-8" });
    if (status !== 0) {
        throw new Error(`vite build failed with exit code ${status}:\n${stderr}`);
    }
    return JSON.parse(stdout.trim().split("\n").pop() ?? "null") as string;
};
