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

// Without the ES2022 lib, at() and Object.hasOwn() are unknown and the declarations degrade to any
const SOURCE = [`export const f = () => [1, 2].at(0);`, `export const has = (o: object) => Object.hasOwn(o, "x");`, ``].join("\n");

let projectDir: string;

beforeEach(() => {
    projectDir = fs.mkdtempSync(path.resolve(__dirname, "..", "test-output-tsc-lib-"));
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "src", "index.ts"), SOURCE);
    fs.writeFileSync(path.join(projectDir, "package.json"), JSON.stringify({ name: "tsc-lib", private: true }));
    jest.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
});

const readDeclarations = (outDir: string): Record<string, string> =>
    Object.fromEntries(
        fs
            .readdirSync(outDir)
            .filter(name => name.endsWith(".d.ts"))
            .sort()
            .map(name => [name, fs.readFileSync(path.join(outDir, name), "utf-8")])
    );

// The project's tsconfig.json leaves lib unset and is strict, so at() keeps undefined in its type; tsc gets the same one with its own outDir
const writeTsConfig = (): string => {
    const tsConfigFile = path.join(projectDir, "tsconfig.json");
    fs.writeFileSync(
        tsConfigFile,
        JSON.stringify({
            compilerOptions: { module: "commonjs", declaration: true, strict: true, outDir: "websmith", rootDir: "src", skipLibCheck: true },
            files: ["src/index.ts"],
        })
    );
    fs.writeFileSync(path.join(projectDir, "tsconfig.tsc.json"), JSON.stringify({ extends: "./tsconfig.json", compilerOptions: { outDir: "tsc" } }));
    return tsConfigFile;
};

const writeConfig = (lib: string[]): string => {
    const configFile = path.join(projectDir, "websmith.config.json");
    fs.writeFileSync(configFile, JSON.stringify({ profiles: { modern: { tsConfig: { lib } } } }));
    return configFile;
};

const compileTscEs2022 = (): Record<string, string> => {
    execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"), "--project", path.join(projectDir, "tsconfig.tsc.json"), "--lib", "es2022"]);
    return readDeclarations(path.join(projectDir, "tsc"));
};

// Resolves the options as the websmith command does for its command-line arguments: the new Compiler reports their errors
const compileWebsmith = (args: CompilerArguments, reporter = new NoReporter()): Record<string, string> => {
    const options = createOptions(args, new NoReporter(), ts.sys);
    new Compiler({ ...options, reporter }, {}, ts.sys).compile();
    return readDeclarations(path.join(projectDir, "websmith"));
};

describe("compile w/ websmith and tsc lib es2022", () => {
    it("emits tsc's declarations w/ lib name ES2022 in a profile's tsConfig", () => {
        const tsConfigFile = writeTsConfig();
        const configFile = writeConfig(["ES2022"]);
        const expected = compileTscEs2022();

        const actual = compileWebsmith({ project: tsConfigFile, configFile, profile: "modern" });

        expect(expected["index.d.ts"]).toContain("number | undefined");
        expect(actual).toEqual(expected);
    }, 60000);

    it("emits tsc's declarations w/ lib file name lib.es2022.d.ts in a profile's tsConfig", () => {
        const tsConfigFile = writeTsConfig();
        const configFile = writeConfig(["lib.es2022.d.ts"]);
        const expected = compileTscEs2022();

        const actual = compileWebsmith({ project: tsConfigFile, configFile, profile: "modern" });

        expect(expected["index.d.ts"]).toContain("number | undefined");
        expect(actual).toEqual(expected);
    }, 60000);

    it("reports an error and emits tsc's declarations w/ unknown lib entry in a profile's tsConfig", () => {
        const tsConfigFile = writeTsConfig();
        const configFile = writeConfig(["ES2022", "bogus"]);
        const expected = compileTscEs2022();
        const target = new NoReporter();
        const targetFn = jest.spyOn(target, "reportDiagnostic");

        const actual = compileWebsmith({ project: tsConfigFile, configFile, profile: "modern" }, target);

        expect(expected["index.d.ts"]).toContain("number | undefined");
        expect(actual).toEqual(expected);
        const errors = targetFn.mock.calls.map(([cur]) => cur).filter(cur => cur.category === ts.DiagnosticCategory.Error);
        expect(errors).toEqual([
            expect.objectContaining({
                messageText: expect.stringMatching(new RegExp(`^Invalid 'tsConfig\\.lib' value 'bogus' in profile 'modern' of '${escapeRegExp(configFile)}'`)),
            }),
        ]);
    }, 60000);
});

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
