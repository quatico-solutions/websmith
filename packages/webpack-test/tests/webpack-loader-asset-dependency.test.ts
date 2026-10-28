/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import fs from "node:fs";
import path from "node:path";
import { runWebpack } from "./run-webpack";
import { writeSourceFile } from "./test-files";

const getProjectDir = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    return path.resolve(__dirname, "..", `test-output-${testId}_${Date.now()}`);
};

let projectDir: string;

beforeEach(() => {
    projectDir = getProjectDir();
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
    writeSourceFile("package.json", JSON.stringify({ type: "module" }), projectDir);
    // The pre-built addons are CommonJS
    writeSourceFile("addons/package.json", JSON.stringify({ type: "commonjs" }), projectDir);
    writeSourceFile(
        "tsconfig.json",
        JSON.stringify({ compilerOptions: { target: "es2020", module: "esnext", moduleResolution: "bundler", rootDir: "src", outDir: "tsout" } }),
        projectDir
    );
    writeSourceFile("websmith.config.json", JSON.stringify({ addonsDir: "./addons", profiles: { target: { addons: ["datap"] } } }), projectDir);
    writeDataAddon();
});

afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
});

describe("webpack w/ websmith-loader and asset dependencies under watch", () => {
    it("emits new processor output of each successive edit of asset dependency", () => {
        writeSourceFile("data-a.txt", "DATA1", projectDir);
        writeSourceFile("src/a.ts", `export const greeting: string = "DATA_IN";\n`, projectDir);

        const actual = runWebpack(projectDir, {
            config: config("./src/a.ts"),
            outputs: ["dist/main.js"],
            steps: [{ "data-a.txt": "DATA2" }, { "data-a.txt": "DATA3" }, { "data-a.txt": "DATA4" }],
        }).map(cur => cur.outputs["dist/main.js"].match(/DATA\d/g));

        expect(actual).toEqual([["DATA1"], ["DATA2"], ["DATA3"], ["DATA4"]]);
    }, 150000);

    it("emits new processor output of edited module only w/ asset dependency per module", () => {
        writeSourceFile("data-a.txt", "ALPHA1", projectDir);
        writeSourceFile("data-b.txt", "BRAVO1", projectDir);
        writeSourceFile("src/index.ts", `import { a } from "./a";\nimport { b } from "./b";\nexport const main = [a, b];\n`, projectDir);
        writeSourceFile("src/a.ts", `export const a: string = "DATA_IN";\n`, projectDir);
        writeSourceFile("src/b.ts", `export const b: string = "DATA_IN";\n`, projectDir);

        const actual = runWebpack(projectDir, {
            config: config("./src/index.ts"),
            outputs: ["dist/main.js"],
            steps: [{ "data-a.txt": "ALPHA2" }, { "data-b.txt": "BRAVO2" }, { "data-a.txt": "ALPHA3" }],
        }).map(cur => cur.outputs["dist/main.js"].match(/(ALPHA|BRAVO)\d/g));

        expect(actual).toEqual([
            ["ALPHA1", "BRAVO1"],
            ["ALPHA2", "BRAVO1"],
            ["ALPHA2", "BRAVO2"],
            ["ALPHA3", "BRAVO2"],
        ]);
    }, 150000);
});

// Replaces "DATA_IN" in a module with the content of the data file named after it, e.g. data-a.txt for a.ts
const writeDataAddon = () =>
    writeSourceFile(
        "addons/datap/addon.js",
        `
            const fs = require("node:fs");
            const path = require("node:path");
            exports.activate = ctx => ctx.registerProcessor((file, content) => {
                const data = path.join(${JSON.stringify(projectDir)}, "data-" + path.basename(file, ".ts") + ".txt");
                if (!fs.existsSync(data)) {
                    return content;
                }
                ctx.addAssetDependency(data, file);
                return content.replaceAll("DATA_IN", fs.readFileSync(data, "utf-8"));
            });
        `,
        projectDir
    );

const config = (entry: string) => `({
    mode: "development",
    devtool: false,
    target: "node",
    context: projectDir,
    entry: { main: ${JSON.stringify(entry)} },
    output: { path: path.join(projectDir, "dist") },
    resolve: { extensions: [".ts", ".js"] },
    module: {
        rules: [
            {
                test: /\\.ts$/,
                use: [{ loader, options: { transpileOnly: false, profile: "target", tsConfigFile: path.join(projectDir, "tsconfig.json"), configFile: path.join(projectDir, "websmith.config.json") } }],
            },
        ],
    },
})`;
