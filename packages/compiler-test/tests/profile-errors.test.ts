/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { Compiler, createOptions, NoReporter } from "@quatico/websmith-core";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

let projectDir: string;

beforeEach(() => {
    projectDir = fs.mkdtempSync(path.resolve(__dirname, "..", "test-output-profile-errors-"));
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "src", "index.ts"), `export const hello: string = "world";\n`);
    fs.writeFileSync(
        path.join(projectDir, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { module: "commonjs", outDir: "dist", rootDir: "src" }, files: ["src/index.ts"] })
    );
    fs.writeFileSync(path.join(projectDir, "websmith.config.json"), JSON.stringify({ profiles: { a: {}, b: {} } }));
    jest.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
});

describe("compile w/ websmith and an unconfigured profile", () => {
    it("reports profile error once and writes nothing w/ unknown profile in config file", () => {
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();
        const options = createOptions(
            { project: path.join(projectDir, "tsconfig.json"), configFile: path.join(projectDir, "websmith.config.json"), profile: "missing" },
            new NoReporter(),
            ts.sys
        );

        new Compiler({ ...options, reporter: target }, {}, ts.sys).compile();
        const actual = jest
            .mocked(target.reportDiagnostic)
            .mock.calls.filter(([cur]) => ts.flattenDiagnosticMessageText(cur.messageText, "\n").startsWith("Profile 'missing' is not configured in"));

        expect(actual).toEqual([[expect.objectContaining({ category: ts.DiagnosticCategory.Error })]]);
        expect(fs.existsSync(path.join(projectDir, "dist"))).toBe(false);
    });
});
