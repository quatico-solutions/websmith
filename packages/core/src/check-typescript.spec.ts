/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkTypeScript } from "./check-typescript";

let projectDir: string;

beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "websmith-check-typescript-"));
});

afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
});

const writeManifest = (manifest: Record<string, unknown>): void => {
    const tsDir = path.join(projectDir, "node_modules", "typescript");
    fs.mkdirSync(tsDir, { recursive: true });
    fs.writeFileSync(path.join(tsDir, "package.json"), JSON.stringify(manifest));
};

describe("checkTypeScript", () => {
    it.each(["5.7.3", "6.0.3"])("should return the version w/ typescript %s", version => {
        writeManifest({ name: "typescript", version, main: "./lib/typescript.js" });

        const actual = checkTypeScript(projectDir);

        expect(actual).toBe(version);
    });

    it("should throw 'none was found' w/o typescript", () => {
        const actual = () => checkTypeScript(projectDir);

        expect(actual).toThrow(new Error("websmith needs typescript >=5.7 <7; none was found. Add typescript to your project."));
    });

    it("should throw 'found 7.0.2' w/ TypeScript 7", () => {
        writeManifest({
            name: "typescript",
            version: "7.0.2",
            type: "module",
            exports: { ".": "./lib/version.cjs", "./package.json": "./package.json" },
        });

        const actual = () => checkTypeScript(projectDir);

        expect(actual).toThrow(
            new Error(
                "websmith needs typescript >=5.7 <7; found 7.0.2. For TypeScript 7, keep typescript@6 as the project's typescript and run 7.x through its own binary (see README)."
            )
        );
    });

    it("should throw 'found 5.6.3' w/ typescript below 5.7", () => {
        writeManifest({ name: "typescript", version: "5.6.3", main: "./lib/typescript.js" });

        const actual = () => checkTypeScript(projectDir);

        expect(actual).toThrow(
            new Error(
                "websmith needs typescript >=5.7 <7; found 5.6.3. For TypeScript 7, keep typescript@6 as the project's typescript and run 7.x through its own binary (see README)."
            )
        );
    });

    it("should throw 'found next' w/ a malformed version", () => {
        writeManifest({ name: "typescript", version: "next", main: "./lib/typescript.js" });

        const actual = () => checkTypeScript(projectDir);

        expect(actual).toThrow(
            new Error(
                "websmith needs typescript >=5.7 <7; found next. For TypeScript 7, keep typescript@6 as the project's typescript and run 7.x through its own binary (see README)."
            )
        );
    });

    it("should throw 'found undefined' w/o a version", () => {
        writeManifest({ name: "typescript", main: "./lib/typescript.js" });

        const actual = () => checkTypeScript(projectDir);

        expect(actual).toThrow(
            new Error(
                "websmith needs typescript >=5.7 <7; found undefined. For TypeScript 7, keep typescript@6 as the project's typescript and run 7.x through its own binary (see README)."
            )
        );
    });
});
