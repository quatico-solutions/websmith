/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createSystem } from "../../environment";
import { resolveProjectFile } from "./resolve-project-file";

describe("resolveProjectFile", () => {
    it("yields absolute file path w/ existing tsconfig file", () => {
        const target = createSystem({ "/project/tsconfig.build.json": "{}" }, { virtual: true });

        const actual = resolveProjectFile(target, "./project/tsconfig.build.json");

        expect(actual).toBe("/project/tsconfig.build.json");
    });

    it("yields tsconfig.json in directory w/ directory path", () => {
        const target = createSystem({ "/project/tsconfig.json": "{}" }, { virtual: true });

        const actual = resolveProjectFile(target, "./project");

        expect(actual).toBe("/project/tsconfig.json");
    });

    it("yields tsconfig.json in current directory w/ current directory path", () => {
        const target = createSystem({ "/tsconfig.json": "{}" }, { virtual: true });

        const actual = resolveProjectFile(target, "./");

        expect(actual).toBe("/tsconfig.json");
    });

    it("yields tsconfig.json in directory w/ directory without tsconfig.json", () => {
        const target = createSystem({ "/project/src/index.ts": "export {};" }, { virtual: true });

        const actual = resolveProjectFile(target, "./project");

        expect(actual).toBe("/project/tsconfig.json");
    });

    it("yields absolute path w/ missing path", () => {
        const target = createSystem({}, { virtual: true });

        const actual = resolveProjectFile(target, "./missing.json");

        expect(actual).toBe("/missing.json");
    });

    it("yields same path w/ already resolved directory", () => {
        const target = createSystem({ "/project/src/index.ts": "export {};" }, { virtual: true });

        const actual = resolveProjectFile(target, resolveProjectFile(target, "./project"));

        expect(actual).toBe("/project/tsconfig.json");
    });

    it("yields same path w/ already resolved file", () => {
        const target = createSystem({ "/project/tsconfig.json": "{}" }, { virtual: true });

        const actual = resolveProjectFile(target, resolveProjectFile(target, "/project/tsconfig.json"));

        expect(actual).toBe("/project/tsconfig.json");
    });
});
