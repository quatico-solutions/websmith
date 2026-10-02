/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilerArguments } from "@quatico/websmith-api";
import { Compiler, createOptions, NoReporter } from "@quatico/websmith-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// ESNext keeps const, native async and class fields that ES5 output rewrites
const SOURCE = [
    `export const load = async () => {`,
    `    const mod = await Promise.resolve({ x: 1 });`,
    `    return mod.x;`,
    `};`,
    `export class Point {`,
    `    x = 1;`,
    `}`,
    ``,
].join("\n");

let projectDir: string;

beforeEach(() => {
    projectDir = fs.mkdtempSync(path.resolve(__dirname, "..", "test-output-tsc-target-"));
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "src", "index.ts"), SOURCE);
    fs.writeFileSync(path.join(projectDir, "package.json"), JSON.stringify({ name: "tsc-target", private: true }));
    jest.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
});

const readOutput = (outDir: string): Record<string, string> =>
    Object.fromEntries(
        fs
            .readdirSync(outDir)
            .filter(name => name.endsWith(".js"))
            .sort()
            .map(name => [name, fs.readFileSync(path.join(outDir, name), "utf-8")])
    );

// The project's tsconfig.json leaves target unset; tsc gets the same one with its own outDir
const writeTsConfig = (): string => {
    const tsConfigFile = path.join(projectDir, "tsconfig.json");
    fs.writeFileSync(
        tsConfigFile,
        JSON.stringify({ compilerOptions: { module: "commonjs", outDir: "websmith", rootDir: "src", skipLibCheck: true }, files: ["src/index.ts"] })
    );
    fs.writeFileSync(path.join(projectDir, "tsconfig.tsc.json"), JSON.stringify({ extends: "./tsconfig.json", compilerOptions: { outDir: "tsc" } }));
    return tsConfigFile;
};

const compileTscEsNext = (): Record<string, string> => {
    execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"), "--project", path.join(projectDir, "tsconfig.tsc.json"), "--target", "esnext"]);
    return readOutput(path.join(projectDir, "tsc"));
};

// Resolves the options as the websmith command does for its command-line arguments
const compileWebsmith = (args: CompilerArguments): Record<string, string> => {
    const options = createOptions(args, new NoReporter(), ts.sys);
    new Compiler({ ...options, reporter: new NoReporter() }, {}, ts.sys).compile();
    return readOutput(path.join(projectDir, "websmith"));
};

describe("compile w/ websmith and tsc target esnext", () => {
    it("emits tsc's JavaScript w/ --target esnext on the command line", () => {
        const tsConfigFile = writeTsConfig();
        const expected = compileTscEsNext();

        const actual = compileWebsmith({ project: tsConfigFile, target: "esnext" });

        expect(expected["index.js"]).toContain("async () =>");
        expect(actual).toEqual(expected);
    }, 60000);

    it("emits tsc's JavaScript w/ target ESNext in a profile's tsConfig", () => {
        const tsConfigFile = writeTsConfig();
        const configFile = path.join(projectDir, "websmith.config.json");
        fs.writeFileSync(configFile, JSON.stringify({ profiles: { modern: { tsConfig: { target: "ESNext" } } } }));
        const expected = compileTscEsNext();

        const actual = compileWebsmith({ project: tsConfigFile, configFile, profile: "modern" });

        expect(expected["index.js"]).toContain("async () =>");
        expect(actual).toEqual(expected);
    }, 60000);
});
