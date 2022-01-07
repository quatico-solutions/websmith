/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
import { createBrowserSystem } from "../environment";
import { createConfig } from "./Config";
import { createParser, parsePaths } from "./Parser";

const testSystem = createBrowserSystem({
    "tsconfig.json": JSON.stringify({}),
    "src/one.js": `{
        export class One {}
    }`,
    "src/two.ts": `{
        export class Two {}
    }`,
    "src/three.tsx": `{
        export class Three {}
    }`,
    "src/_four.css": `{
        .four {
            display: none;
        }
    }`,
    "src/_five.scss": `{
        .five {
            display: none;
        }
    }`,
    "src/six.scss": `{
        .five {
            display: none;
        }
    }`,
    "src/seven.scss": `{
        .seven {
            display: none;
        }
    }`,
    "src/seven.ts": `{
        import "./seven.scss";
        @customElement("my-seven")
        export class Seven {}
    }`,
});

describe("createParser", () => {
    it("yields script names and no style name with direct single file input", () => {
        const compilerOptions = createConfig("tsconfig.json", testSystem).options;
        const parse = createParser({ system: testSystem, compilerOptions });

        const actual = parse(["/one.ts"]);

        expect(actual.program.getRootFileNames()).toEqual(["/one.ts"]);
        expect(actual.filePaths).toEqual(["/one.ts"]);
        expect(actual.scriptPaths).toEqual(["/one.ts"]);
        expect(actual.stylePaths).toEqual([]);
    });

    it("yields script names and no style name with direct single file input and global files", () => {
        const config = createConfig("tsconfig.json", testSystem);
        const parse = createParser({
            system: testSystem,
            compilerOptions: config.options,
            filePaths: config.fileNames,
        });

        const actual = parse(["/one.ts"]);

        expect(actual.program.getRootFileNames()).toEqual(["/one.ts"]);
        expect(actual.filePaths).toEqual(["/one.ts"]);
        expect(actual.scriptPaths).toEqual(["/one.ts"]);
        expect(actual.stylePaths).toEqual([]);
    });

    it("yields script and style names with global file inputs", () => {
        const config = createConfig("tsconfig.json", testSystem);
        const parse = createParser({
            system: testSystem,
            compilerOptions: config.options,
            filePaths: config.fileNames,
        });

        const actual = parse();

        expect(actual.program.getRootFileNames()).toEqual([
            "src/two.ts",
            "src/three.tsx",
            "src/seven.ts",
            "src/_four.css",
            "src/_five.scss",
            "src/six.scss",
            "src/seven.scss",
        ]);
        expect(actual.filePaths).toEqual([
            "src/two.ts",
            "src/three.tsx",
            "src/seven.ts",
            "src/_four.css",
            "src/_five.scss",
            "src/six.scss",
            "src/seven.scss",
        ]);
        expect(actual.scriptPaths).toEqual(["src/two.ts", "src/three.tsx", "src/seven.ts"]);
        expect(actual.stylePaths).toEqual(["src/_four.css", "src/_five.scss", "src/six.scss", "src/seven.scss"]);
    });
});

describe("parsePaths", () => {
    const compilerOptions = createConfig("tsconfig.json", testSystem).options;
    const system = testSystem;

    it("returns paths with direct script filePaths", () => {
        const actual = parsePaths({ compilerOptions, system }, ["/one.ts", "/two.ts", "/three.js"]);

        expect(actual).toEqual(["/one.ts", "/two.ts", "/three.js"]);
    });

    it("returns paths with direct style filePaths", () => {
        const actual = parsePaths({ compilerOptions, system }, ["/one.css", "/two.scss", "/three.scss"]);

        expect(actual).toEqual(["/one.css", "/two.scss", "/three.scss"]);
    });

    it("returns path with direct script and style paths", () => {
        const actual = parsePaths({ compilerOptions, system }, ["/one.js", "/two.ts", "/three.tsx", "/four.css", "/five.scss"]);

        expect(actual).toEqual(["/one.js", "/two.ts", "/three.tsx", "/four.css", "/five.scss"]);
    });

    it("returns paths with global filePaths", () => {
        const actual = parsePaths({
            compilerOptions,
            system,
            filePaths: ["src/one.js", "src/two.ts", "src/three.tsx", "src/_four.css", "src/_five.scss"],
        });

        expect(actual).toEqual(["src/one.js", "src/two.ts", "src/three.tsx", "src/_four.css", "src/_five.scss", "src/six.scss", "src/seven.scss"]);
    });

    it("returns paths with global fileNames", () => {
        const actual = parsePaths({
            compilerOptions,
            system,
            filePaths: ["one.js", "two.ts", "three.tsx", "_four.css", "_five.scss"],
        });

        expect(actual).toEqual([
            "one.js",
            "two.ts",
            "three.tsx",
            "_four.css",
            "_five.scss",
            "src/_four.css",
            "src/_five.scss",
            "src/six.scss",
            "src/seven.scss",
        ]);
    });

    it("return direct paths with global and direct fileNames", () => {
        const actual = parsePaths(
            {
                compilerOptions,
                system,
                filePaths: ["one.js", "two.ts", "three.tsx", "_four.css", "_five.scss"],
            },
            ["zip.js", "zap.css", "zup.tsx"]
        );

        expect(actual).toEqual(["zip.js", "zap.css", "zup.tsx"]);
    });
});
