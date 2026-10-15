/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createSystem } from "@quatico/websmith-core";
import ts from "typescript";
import { checkModuleFormat, checkTargetModule, selectConfigErrors } from "./config-errors";

const NODENEXT: ts.CompilerOptions = { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext };

// The node module kinds of the installed TypeScript; Node18 and Node20 exist only in TypeScript 6
const NODE_MODULE_KINDS = ["Node16", "Node18", "Node20", "NodeNext"].filter(name => name in ts.ModuleKind);

const createModuleSystem = (files: Record<string, string>): ts.System => createSystem(files, { virtual: true });

const createCache = (): ts.PackageJsonInfoCache => ts.createModuleResolutionCache("/", cur => cur).getPackageJsonInfoCache();

const diagnostic = (category: ts.DiagnosticCategory): ts.Diagnostic => ({
    category,
    code: 1,
    file: undefined,
    start: undefined,
    length: undefined,
    messageText: "whatever",
});

describe("selectConfigErrors", () => {
    it("should return errors w/ errors in build", () => {
        const target = diagnostic(ts.DiagnosticCategory.Error);

        const actual = selectConfigErrors("build", undefined, [diagnostic(ts.DiagnosticCategory.Warning), target]);

        expect(actual).toEqual([target]);
    });

    it("should return none w/ build error", () => {
        const actual = selectConfigErrors("build", new Error("whatever"), [diagnostic(ts.DiagnosticCategory.Error)]);

        expect(actual).toEqual([]);
    });

    it("should return none w/ warnings only", () => {
        const actual = selectConfigErrors("build", undefined, [diagnostic(ts.DiagnosticCategory.Warning)]);

        expect(actual).toEqual([]);
    });

    it("should return none w/ errors in serve", () => {
        const actual = selectConfigErrors("serve", undefined, [diagnostic(ts.DiagnosticCategory.Error)]);

        expect(actual).toEqual([]);
    });
});

describe("checkTargetModule", () => {
    it.each([
        ["CommonJS", ts.ModuleKind.CommonJS],
        ["AMD", ts.ModuleKind.AMD],
        ["UMD", ts.ModuleKind.UMD],
        ["System", ts.ModuleKind.System],
    ])("should return error naming profile and module w/ module %s", (name, module) => {
        const actual = checkTargetModule("app", { module }, false)?.messageText;

        expect(actual).toBe(
            `Profile 'app' emits ${name} ('tsConfig.module' is '${name.toLowerCase()}'), which Vite cannot bundle as an ES module. Use "ESNext" or "ES2022".`
        );
    });

    it("should return error w/ unset module and target ES5", () => {
        const actual = checkTargetModule("app", { target: ts.ScriptTarget.ES5 }, false)?.messageText;

        expect(actual).toBe(`Profile 'app' emits CommonJS ('tsConfig.module' is unset and 'target' is 'ES5'), which Vite cannot bundle as an ES module. Use "ESNext" or "ES2022".`);
    });

    it("should return error category w/ commonjs module", () => {
        const actual = checkTargetModule("app", { module: ts.ModuleKind.CommonJS }, false)?.category;

        expect(actual).toBe(ts.DiagnosticCategory.Error);
    });

    it("should return none w/ unset module and target ES2022", () => {
        const actual = checkTargetModule("app", { target: ts.ScriptTarget.ES2022 }, false);

        expect(actual).toBeUndefined();
    });

    it("should return none w/ module ESNext", () => {
        const actual = checkTargetModule("app", { module: ts.ModuleKind.ESNext }, false);

        expect(actual).toBeUndefined();
    });

    it("should return none w/ commonjs module and esm set", () => {
        const actual = checkTargetModule("app", { module: ts.ModuleKind.CommonJS }, true);

        expect(actual).toBeUndefined();
    });

    it("should name default profile w/o profile", () => {
        const actual = checkTargetModule(undefined, { module: ts.ModuleKind.CommonJS }, false)?.messageText;

        expect(actual).toMatch(/^The default profile emits CommonJS/);
    });
});

describe("checkModuleFormat", () => {
    it("should return error naming file and package.json w/ nodenext and no type in package.json", () => {
        const system = createModuleSystem({ "/project/package.json": "{}", "/project/src/main.ts": "export {};" });

        const actual = checkModuleFormat("app", "/project/src/main.ts", NODENEXT, false, system, createCache(), new Map());

        expect([actual.error?.category, actual.error?.messageText, actual.packageJson]).toEqual([
            ts.DiagnosticCategory.Error,
            `Profile 'app' emits CommonJS for '/project/src/main.ts' ('tsConfig.module' is 'nodenext' and the nearest package.json ` +
                `'/project/package.json' has no "type": "module"), which Vite cannot bundle as an ES module. ` +
                `Set "type": "module", use the .mts extension, or use "ESNext".`,
            "/project/package.json",
        ]);
    });

    it("should return package.json only w/ nodenext and type module", () => {
        const system = createModuleSystem({ "/project/package.json": `{"type":"module"}`, "/project/src/main.ts": "export {};" });

        const actual = checkModuleFormat("app", "/project/src/main.ts", NODENEXT, false, system, createCache(), new Map());

        expect(actual).toEqual({ packageJson: "/project/package.json" });
    });

    it("should return none w/ nodenext and mts file", () => {
        const system = createModuleSystem({ "/project/package.json": "{}", "/project/src/main.mts": "export {};" });

        const actual = checkModuleFormat("app", "/project/src/main.mts", NODENEXT, false, system, createCache(), new Map()).error;

        expect(actual).toBeUndefined();
    });

    it("should return error naming extension w/ nodenext and cts file", () => {
        const system = createModuleSystem({ "/project/package.json": `{"type":"module"}`, "/project/src/main.cts": "export {};" });

        const actual = checkModuleFormat("app", "/project/src/main.cts", NODENEXT, false, system, createCache(), new Map());

        expect([actual.error?.messageText, actual.packageJson]).toEqual([
            `Profile 'app' emits CommonJS for '/project/src/main.cts' ('tsConfig.module' is 'nodenext' and the file has the .cts extension), ` +
                `which Vite cannot bundle as an ES module. Set "type": "module", use the .mts extension, or use "ESNext".`,
            undefined,
        ]);
    });

    it("should return none w/ module ESNext", () => {
        const system = createModuleSystem({ "/project/package.json": "{}", "/project/src/main.ts": "export {};" });

        const actual = checkModuleFormat("app", "/project/src/main.ts", { module: ts.ModuleKind.ESNext }, false, system, createCache(), new Map());

        expect(actual).toEqual({});
    });

    it("should return none w/ nodenext and esm set", () => {
        const system = createModuleSystem({ "/project/package.json": "{}", "/project/src/main.ts": "export {};" });

        const actual = checkModuleFormat("app", "/project/src/main.ts", NODENEXT, true, system, createCache(), new Map());

        expect(actual).toEqual({});
    });

    it("should return error naming module w/ node16 and no type in package.json", () => {
        const system = createModuleSystem({ "/project/package.json": "{}", "/project/src/main.ts": "export {};" });

        const actual = checkModuleFormat("app", "/project/src/main.ts", { module: ts.ModuleKind.Node16 }, false, system, createCache(), new Map()).error
            ?.messageText;

        expect(actual).toMatch(/^Profile 'app' emits CommonJS for '\/project\/src\/main.ts' \('tsConfig.module' is 'node16' and/);
    });

    it.each(NODE_MODULE_KINDS)("should return error naming module w/ %s and no type in package.json", name => {
        const system = createModuleSystem({ "/project/package.json": "{}", "/project/src/main.ts": "export {};" });
        const module = ts.ModuleKind[name as keyof typeof ts.ModuleKind];

        const actual = checkModuleFormat("app", "/project/src/main.ts", { module }, false, system, createCache(), new Map()).error?.messageText;

        expect(actual).toMatch(
            new RegExp(`^Profile 'app' emits CommonJS for '/project/src/main.ts' \\('tsConfig.module' is '${name.toLowerCase()}' and`)
        );
    });

    it("should return none w/ module value the installed TypeScript does not have", () => {
        const system = createModuleSystem({ "/project/package.json": "{}", "/project/src/main.ts": "export {};" });

        const actual = checkModuleFormat("app", "/project/src/main.ts", { module: 150 as ts.ModuleKind }, false, system, createCache(), new Map());

        expect(actual).toEqual({});
    });

    it("should name default profile w/o profile", () => {
        const system = createModuleSystem({ "/project/package.json": "{}", "/project/src/main.ts": "export {};" });

        const actual = checkModuleFormat(undefined, "/project/src/main.ts", NODENEXT, false, system, createCache(), new Map()).error?.messageText;

        expect(actual).toMatch(/^The default profile emits CommonJS for/);
    });

    it("should return error naming no package.json w/ nodenext and no package.json", () => {
        const system = createModuleSystem({ "/project/src/main.ts": "export {};" });

        const actual = checkModuleFormat("app", "/project/src/main.ts", NODENEXT, false, system, createCache(), new Map());

        expect([actual.error?.messageText, actual.packageJson]).toEqual([
            `Profile 'app' emits CommonJS for '/project/src/main.ts' ('tsConfig.module' is 'nodenext' and no package.json above it has ` +
                `"type": "module"), which Vite cannot bundle as an ES module. Set "type": "module", use the .mts extension, or use "ESNext".`,
            undefined,
        ]);
    });

    it("should not look up package.json w/ second module in same directory", () => {
        const system = createModuleSystem({ "/project/package.json": "{}", "/project/src/main.ts": "export {};", "/project/src/b.ts": "export {};" });
        const cache = createCache();
        const found = new Map<string, string | undefined>();
        checkModuleFormat("app", "/project/src/main.ts", NODENEXT, false, system, cache, found);
        const target = jest.spyOn(system, "fileExists");

        const actual = checkModuleFormat("app", "/project/src/b.ts", NODENEXT, false, system, cache, found).packageJson;

        expect(actual).toBe("/project/package.json");
        expect(target).not.toHaveBeenCalled();
    });

    it("should find package.json created later w/ cleared caches", () => {
        const system = createModuleSystem({ "/project/package.json": "{}", "/project/src/main.ts": "export {};" });
        const cache = createCache();
        const found = new Map<string, string | undefined>();
        checkModuleFormat("app", "/project/src/main.ts", NODENEXT, false, system, cache, found);
        system.writeFile("/project/src/package.json", `{"type":"module"}`);
        cache.clear();
        found.clear();

        const actual = checkModuleFormat("app", "/project/src/main.ts", NODENEXT, false, system, cache, found);

        expect(actual).toEqual({ packageJson: "/project/src/package.json" });
    });
});
