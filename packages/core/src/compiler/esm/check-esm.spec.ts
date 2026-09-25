/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { InfoMessage, type EsmProfileOptions } from "@quatico/websmith-api";
import ts from "typescript";
import { createSystem } from "../../environment";
import { NoReporter } from "../NoReporter";
import { checkEsm, getEmittedModuleKind, type EsmCheckContext } from "./check-esm";

const MODULE_PACKAGE = { "/package.json": JSON.stringify({ type: "module" }) };

const createContext = (files: Record<string, string> = MODULE_PACKAGE, overrides: Partial<EsmCheckContext> = {}): EsmCheckContext => {
    const system = createSystem(files, { virtual: true });
    return { system, reporter: new NoReporter(), projectDir: "/", ...overrides };
};

const output = (name: string, text: string): ts.OutputFile => ({ name, text, writeByteOrderMark: false });

const codesOf = (files: ts.OutputFile[], esm: EsmProfileOptions, context = createContext()): number[] =>
    checkEsm(files, esm, context).map(cur => cur.code);

describe("checkEsm", () => {
    it("yields 91001 w/ free require in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", `const x = require("x");`)], { runtime: "node" });

        expect(actual).toEqual([91001]);
    });

    it("yields nothing w/ require declared by createRequire in node ESM output", () => {
        const actual = codesOf(
            [
                output(
                    "/dist/target.js",
                    `import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);\nrequire("x");`
                ),
            ],
            { runtime: "node" }
        );

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ typeof guarded require in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", `export const x = typeof require !== "undefined" ? require("x") : null;`)], {
            runtime: "node",
        });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ module.exports in .cjs file of node ESM profile", () => {
        const actual = codesOf([output("/dist/target.cjs", `module.exports = require("x");`)], { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields 91002 w/ free module and exports in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", `use(module.id, exports.x);`)], { runtime: "node" });

        expect(actual).toEqual([91002, 91002]);
    });

    it("yields 91003 w/ free __dirname and __filename in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", `use(__dirname, __filename);`)], { runtime: "node" });

        expect(actual).toEqual([91003, 91003]);
    });

    it("yields 91002 w/ module.exports assignment without ESM syntax in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", `module.exports = 42;`)], { runtime: "node" });

        expect(actual).toEqual([91002]);
    });

    it("yields only 91004 w/ ESM syntax mixed with module.exports in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", `import x from "y";\nmodule.exports = x;`)], { runtime: "node" });

        expect(actual).toEqual([91004]);
    });

    it("yields 91004 w/ ESM syntax mixed with module.exports in bundler auto output", () => {
        const actual = codesOf([output("/dist/target.js", `import x from "y";\nmodule.exports = x;`)], { runtime: "bundler" }, createContext({}));

        expect(actual).toEqual([91004]);
    });

    it("yields 91004 w/ ESM syntax mixed with exports property in bundler auto output", () => {
        const actual = codesOf([output("/dist/target.js", `export const y = 1;\nexports.x = y;`)], { runtime: "bundler" }, createContext({}));

        expect(actual).toEqual([91004]);
    });

    it("yields nothing w/ free require, module and __dirname in bundler auto output", () => {
        const actual = codesOf(
            [output("/dist/target.js", `import x from "y";\nrequire("x"); use(module.id, __dirname);`)],
            { runtime: "bundler" },
            createContext({})
        );

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ free require, module and __dirname in bundler .cjs output", () => {
        const actual = codesOf([output("/dist/target.cjs", `require("x"); use(module.id, __dirname);`)], { runtime: "bundler" });

        expect(actual).toEqual([]);
    });

    it("yields 91004 w/ ESM syntax mixed with module.exports in bundler .cjs output", () => {
        const actual = codesOf([output("/dist/target.cjs", `import x from "y";\nmodule.exports = x;`)], { runtime: "bundler" });

        expect(actual).toEqual([91004]);
    });

    it("yields 91004 w/ ESM syntax mixed with module.exports in bundler output under commonjs package", () => {
        const actual = codesOf(
            [output("/dist/target.js", `import x from "y";\nrequire("z");\nmodule.exports = x;`)],
            { runtime: "bundler" },
            createContext({ "/package.json": JSON.stringify({ type: "commonjs" }) })
        );

        expect(actual).toEqual([91004]);
    });

    it("yields 91001 w/ free require in bundler .mjs output", () => {
        const actual = codesOf([output("/dist/target.mjs", `require("x");`)], { runtime: "bundler" }, createContext({}));

        expect(actual).toEqual([91001]);
    });

    it("yields 91001 w/ free require in bundler output under module package", () => {
        const actual = codesOf([output("/dist/target.js", `require("x");`)], { runtime: "bundler" });

        expect(actual).toEqual([91001]);
    });

    it("yields warning 91005 w/ ESM syntax and no package type in node output", () => {
        const actual = checkEsm([output("/dist/target.js", `export const x = 1;`)], { runtime: "node" }, createContext({})).map(cur => [
            cur.code,
            cur.category,
        ]);

        expect(actual).toEqual([[91005, ts.DiagnosticCategory.Warning]]);
    });

    it("yields 91005 and 91001 w/ ESM syntax, free require and no package type in node output", () => {
        const actual = codesOf([output("/dist/target.js", `export const x = require("x");`)], { runtime: "node" }, createContext({}));

        expect(actual).toEqual([91005, 91001]);
    });

    it("yields error category w/ default check", () => {
        const actual = checkEsm([output("/dist/target.js", `require("x");`)], { runtime: "node" }, createContext()).map(cur => cur.category);

        expect(actual).toEqual([ts.DiagnosticCategory.Error]);
    });

    it("yields warning category w/ check warn", () => {
        const actual = checkEsm([output("/dist/target.js", `require("x");`)], { runtime: "node", check: "warn" }, createContext()).map(
            cur => cur.category
        );

        expect(actual).toEqual([ts.DiagnosticCategory.Warning]);
    });

    it("yields warning 91005 w/ check warn and no package type in node output", () => {
        const actual = checkEsm(
            [output("/dist/target.js", `export const x = require("x");`)],
            { runtime: "node", check: "warn" },
            createContext({})
        ).map(cur => [cur.code, cur.category]);

        expect(actual).toEqual([
            [91005, ts.DiagnosticCategory.Warning],
            [91001, ts.DiagnosticCategory.Warning],
        ]);
    });

    it("yields 91005 warning and 91001 w/ top-level await, free require and no package type in node output", () => {
        const actual = checkEsm([output("/dist/target.js", `const x = await load();\nrequire("x");`)], { runtime: "node" }, createContext({})).map(
            cur => [cur.code, cur.category]
        );

        expect(actual).toEqual([
            [91005, ts.DiagnosticCategory.Warning],
            [91001, ts.DiagnosticCategory.Error],
        ]);
    });

    it("yields nothing w/ check off", () => {
        const actual = codesOf([output("/dist/target.js", `require("x");`)], { runtime: "node", check: "off" });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ non-JavaScript output files", () => {
        const actual = codesOf(
            [output("/dist/target.d.ts", `export declare const x: typeof require;`), output("/dist/target.js.map", `{"names":["require"]}`)],
            { runtime: "node" }
        );

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ file matching ignore pattern", () => {
        const actual = codesOf([output("/dist/shims/legacy.js", `require("x");`)], { runtime: "node", ignore: ["dist/**/*.js"] });

        expect(actual).toEqual([]);
    });

    it("yields diagnostic w/ file not matching ignore pattern", () => {
        const actual = codesOf([output("/dist/target.js", `require("x");`)], { runtime: "node", ignore: ["./dist/shims/*.js"] });

        expect(actual).toEqual([91001]);
    });

    it("yields nothing w/ file matching absolute ignore pattern", () => {
        const actual = codesOf([output("/dist/shims/legacy.js", `require("x");`)], { runtime: "node", ignore: ["/dist/shims/*.js"] });

        expect(actual).toEqual([]);
    });

    it("yields diagnostic w/o error w/ non-string ignore entries", () => {
        const ignore = [1, null, "dist/shims/*.js"] as unknown as string[];

        const actual = codesOf([output("/dist/target.js", `require("x");`), output("/dist/shims/legacy.js", `require("x");`)], {
            runtime: "node",
            ignore,
        });

        expect(actual).toEqual([91001]);
    });

    it("yields diagnostic w/ string ignore value", () => {
        const ignore = "dist/*.js" as unknown as string[];

        const actual = codesOf([output("/dist/target.js", `require("x");`)], { runtime: "node", ignore });

        expect(actual).toEqual([91001]);
    });

    it("yields nothing w/ file matching backslash ignore pattern", () => {
        const actual = codesOf([output("/dist/shims/legacy.mjs", `require("x");`)], { runtime: "node", ignore: ["dist\\shims\\*.mjs"] });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ Windows file matching ignore pattern of other case", () => {
        const actual = codesOf(
            [output("C:/Project/dist/Legacy.mjs", `require("x");`)],
            { runtime: "node", ignore: ["DIST\\*.mjs"] },
            createContext({}, { projectDir: "c:\\project", platform: "win32" })
        );

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ Windows file matching absolute backslash ignore pattern", () => {
        const actual = codesOf(
            [output("C:/Project/dist/legacy.mjs", `require("x");`)],
            { runtime: "node", ignore: ["c:\\project\\dist\\*.mjs"] },
            createContext({}, { projectDir: "C:\\Project", platform: "win32" })
        );

        expect(actual).toEqual([]);
    });

    it("yields diagnostic w/ Linux file matching ignore pattern of other case only", () => {
        const actual = codesOf(
            [output("/project/dist/Legacy.mjs", `require("x");`)],
            { runtime: "node", ignore: ["dist/legacy.mjs"] },
            createContext({}, { projectDir: "/project", platform: "linux" })
        );

        expect(actual).toEqual([91001]);
    });

    it("reports ignored file w/ debug", () => {
        const reporter = new NoReporter();
        const target = jest.spyOn(reporter, "reportDiagnostic");

        checkEsm(
            [output("/dist/shims/legacy.js", `require("x");`)],
            { runtime: "node", ignore: ["dist/shims/*.js"] },
            createContext(MODULE_PACKAGE, { reporter, debug: true })
        );

        expect(target).toHaveBeenCalledWith(
            new InfoMessage(`ESM check skipped "/dist/shims/legacy.js": matches esm.ignore pattern "dist/shims/*.js".`)
        );
    });

    it("reports nothing about ignored file w/o debug", () => {
        const reporter = new NoReporter();
        const target = jest.spyOn(reporter, "reportDiagnostic");

        checkEsm(
            [output("/dist/shims/legacy.js", `require("x");`)],
            { runtime: "node", ignore: ["dist/shims/*.js"] },
            createContext(MODULE_PACKAGE, { reporter })
        );

        expect(target).not.toHaveBeenCalled();
    });

    it("reports package.json dependencies of checked file", () => {
        const onDependency = jest.fn();

        checkEsm([output("/dist/target.js", `export const x = 1;`)], { runtime: "node" }, createContext(MODULE_PACKAGE, { onDependency }));
        const actual = onDependency.mock.calls;

        expect(actual).toEqual([
            ["/dist/package.json", false],
            ["/package.json", true],
        ]);
    });

    it("yields diagnostic located in emitted file", () => {
        const [actual] = checkEsm([output("/dist/target.js", `const x = require("x");`)], { runtime: "node" }, createContext());

        expect([actual.file?.fileName, actual.start, actual.length]).toEqual(["/dist/target.js", 10, 7]);
    });

    it("yields message with code, fix hint, profile and addons", () => {
        const [actual] = checkEsm(
            [output("/dist/target.js", `const x = require("x");`)],
            { runtime: "node" },
            createContext(MODULE_PACKAGE, { profile: "client", addons: ["one-addon", "two-addon"] })
        );

        expect(actual.messageText).toBe(
            `ESM91001: "require" is not defined in ES module output; use "import" or "createRequire(import.meta.url)" instead (profile "client", addons: one-addon, two-addon).`
        );
    });
});

describe("getEmittedModuleKind", () => {
    it("yields CommonJS w/o module and ES5 target", () => {
        const actual = getEmittedModuleKind({ target: ts.ScriptTarget.ES5 });

        expect(actual).toBe(ts.ModuleKind.CommonJS);
    });

    it("yields CommonJS w/o module and target", () => {
        const actual = getEmittedModuleKind({});

        expect(actual).toBe(ts.ModuleKind.CommonJS);
    });

    it("yields ES2015 w/o module and ES2020 target", () => {
        const actual = getEmittedModuleKind({ target: ts.ScriptTarget.ES2020 });

        expect(actual).toBe(ts.ModuleKind.ES2015);
    });

    it("yields ES2015 w/o module and es2020 target name", () => {
        const actual = getEmittedModuleKind({ target: "es2020" });

        expect(actual).toBe(ts.ModuleKind.ES2015);
    });

    it("yields CommonJS w/o module and ES5 target name", () => {
        const actual = getEmittedModuleKind({ target: "ES5" });

        expect(actual).toBe(ts.ModuleKind.CommonJS);
    });

    it("yields module w/ module and ES5 target", () => {
        const actual = getEmittedModuleKind({ module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES5 });

        expect(actual).toBe(ts.ModuleKind.ESNext);
    });

    it("yields module name w/ module name and ES2020 target", () => {
        const actual = getEmittedModuleKind({ module: "CommonJS", target: ts.ScriptTarget.ES2020 });

        expect(actual).toBe("CommonJS");
    });
});
