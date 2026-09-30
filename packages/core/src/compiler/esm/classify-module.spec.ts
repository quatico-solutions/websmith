/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createSystem } from "../../environment";
import { classifyModule, createPackageTypeLookup, type PackageTypeCache } from "./classify-module";

describe("classifyModule", () => {
    it("yields esm w/ node runtime and .mjs file under commonjs package", () => {
        const actual = classifyModule("/dist/target.mjs", "node", false, () => ({ packageJson: "/package.json", type: "commonjs" }));

        expect(actual).toEqual({ kind: "esm", typeMissing: false });
    });

    it("yields commonjs w/ node runtime and .cjs file with ESM syntax under module package", () => {
        const actual = classifyModule("/dist/target.cjs", "node", true, () => ({ packageJson: "/package.json", type: "module" }));

        expect(actual).toEqual({ kind: "commonjs", typeMissing: false });
    });

    it("yields esm w/ node runtime and .js file under module package", () => {
        const actual = classifyModule("/dist/target.js", "node", false, () => ({ packageJson: "/package.json", type: "module" }));

        expect(actual).toEqual({ kind: "esm", typeMissing: false, packageJson: "/package.json" });
    });

    it("yields commonjs w/ node runtime and .js file with ESM syntax under commonjs package", () => {
        const actual = classifyModule("/dist/target.js", "node", true, () => ({ packageJson: "/package.json", type: "commonjs" }));

        expect(actual).toEqual({ kind: "commonjs", typeMissing: false, packageJson: "/package.json" });
    });

    it("yields esm and missing type w/ node runtime and .js file with ESM syntax without package type", () => {
        const actual = classifyModule("/dist/target.js", "node", true, () => undefined);

        expect(actual).toEqual({ kind: "esm", typeMissing: true });
    });

    it("yields commonjs and missing type w/ node runtime and .js file without ESM syntax and package type", () => {
        const actual = classifyModule("/dist/target.js", "node", false, () => undefined);

        expect(actual).toEqual({ kind: "commonjs", typeMissing: true });
    });

    it("yields esm w/ bundler runtime and .mjs file", () => {
        const actual = classifyModule("/dist/target.mjs", "bundler", false, () => undefined);

        expect(actual).toEqual({ kind: "esm", typeMissing: false });
    });

    it("yields esm w/ bundler runtime and .js file under module package", () => {
        const actual = classifyModule("/dist/target.js", "bundler", false, () => ({ packageJson: "/package.json", type: "module" }));

        expect(actual).toEqual({ kind: "esm", typeMissing: false, packageJson: "/package.json" });
    });

    it("yields auto w/ bundler runtime and .js file with ESM syntax without package type", () => {
        const actual = classifyModule("/dist/target.js", "bundler", true, () => undefined);

        expect(actual).toEqual({ kind: "auto", typeMissing: false });
    });

    it("yields dynamic w/ bundler runtime and .cjs file under module package", () => {
        const actual = classifyModule("/dist/target.cjs", "bundler", true, () => ({ packageJson: "/package.json", type: "module" }));

        expect(actual).toEqual({ kind: "dynamic", typeMissing: false });
    });

    it("yields dynamic w/ bundler runtime and .js file under commonjs package", () => {
        const actual = classifyModule("/dist/target.js", "bundler", true, () => ({ packageJson: "/package.json", type: "commonjs" }));

        expect(actual).toEqual({ kind: "dynamic", typeMissing: false, packageJson: "/package.json" });
    });

    it("yields auto w/ bundler runtime and .js file under package without type", () => {
        const actual = classifyModule("/dist/target.js", "bundler", true, () => ({ packageJson: "/package.json" }));

        expect(actual).toEqual({ kind: "auto", typeMissing: false });
    });
});

describe("createPackageTypeLookup", () => {
    it("yields type of nearest package.json", () => {
        const target = createSystem(
            { "/package.json": JSON.stringify({ type: "commonjs" }), "/dist/package.json": JSON.stringify({ type: "module" }) },
            { virtual: true }
        );
        const testObj = createPackageTypeLookup(target);

        const actual = testObj("/dist/sub/target.js");

        expect(actual).toEqual({ packageJson: "/dist/package.json", type: "module" });
    });

    it("yields nearest package.json without type w/ outer package.json with type", () => {
        const target = createSystem(
            { "/package.json": JSON.stringify({ type: "module" }), "/dist/package.json": JSON.stringify({ name: "whatever" }) },
            { virtual: true }
        );
        const testObj = createPackageTypeLookup(target);

        const actual = testObj("/dist/target.js");

        expect(actual).toEqual({ packageJson: "/dist/package.json" });
    });

    it("yields undefined w/o package.json", () => {
        const target = createSystem({ "/dist/target.js": "whatever" }, { virtual: true });
        const testObj = createPackageTypeLookup(target);

        const actual = testObj("/dist/target.js");

        expect(actual).toBeUndefined();
    });

    it("yields package.json without type w/ invalid package.json", () => {
        const target = createSystem({ "/package.json": "{ invalid" }, { virtual: true });
        const testObj = createPackageTypeLookup(target);

        const actual = testObj("/dist/target.js");

        expect(actual).toEqual({ packageJson: "/package.json" });
    });

    it("reads each package.json once w/ multiple files in same directory", () => {
        const target = createSystem({ "/package.json": JSON.stringify({ type: "module" }) }, { virtual: true });
        const readFile = jest.spyOn(target, "readFile");
        const testObj = createPackageTypeLookup(target);

        testObj("/dist/one.js");
        testObj("/dist/two.js");
        const actual = readFile.mock.calls.length;

        expect(actual).toBe(1);
    });

    it("reports missing and found package.json paths w/ package.json two levels up", () => {
        const onDependency = jest.fn();
        const testObj = createPackageTypeLookup(
            createSystem({ "/package.json": JSON.stringify({ type: "module" }) }, { virtual: true }),
            onDependency
        );

        testObj("/dist/sub/target.js");
        const actual = onDependency.mock.calls;

        expect(actual).toEqual([
            ["/dist/sub/package.json", false],
            ["/dist/package.json", false],
            ["/package.json", true],
        ]);
    });

    it("reports same package.json paths w/ cached lookup", () => {
        const onDependency = jest.fn();
        const testObj = createPackageTypeLookup(
            createSystem({ "/package.json": JSON.stringify({ type: "module" }) }, { virtual: true }),
            onDependency
        );
        testObj("/dist/sub/one.js");
        onDependency.mockClear();

        testObj("/dist/sub/two.js");
        const actual = onDependency.mock.calls;

        expect(actual).toEqual([
            ["/dist/sub/package.json", false],
            ["/dist/package.json", false],
            ["/package.json", true],
        ]);
    });

    it("reports full package.json paths to each lookup w/ cache shared by two lookups", () => {
        const system = createSystem({ "/package.json": JSON.stringify({ type: "module" }) }, { virtual: true });
        const cache: PackageTypeCache = new Map();
        const onDependency = jest.fn();
        createPackageTypeLookup(system, () => undefined, cache)("/dist/sub/one.js");
        const testObj = createPackageTypeLookup(system, onDependency, cache);

        testObj("/dist/sub/two.js");
        const actual = onDependency.mock.calls;

        expect(actual).toEqual([
            ["/dist/sub/package.json", false],
            ["/dist/package.json", false],
            ["/package.json", true],
        ]);
    });

    it("reads each package.json once w/ cache shared by two lookups", () => {
        const target = createSystem({ "/package.json": JSON.stringify({ type: "module" }) }, { virtual: true });
        const readFile = jest.spyOn(target, "readFile");
        const cache: PackageTypeCache = new Map();
        createPackageTypeLookup(target, undefined, cache)("/dist/one.js");
        const testObj = createPackageTypeLookup(target, undefined, cache);

        testObj("/dist/two.js");
        const actual = readFile.mock.calls.length;

        expect(actual).toBe(1);
    });

    it("reports missing package.json paths w/o package.json", () => {
        const onDependency = jest.fn();
        const testObj = createPackageTypeLookup(createSystem({}, { virtual: true }), onDependency);

        testObj("/dist/target.js");
        const actual = onDependency.mock.calls;

        expect(actual).toEqual([
            ["/dist/package.json", false],
            ["/package.json", false],
        ]);
    });
});
