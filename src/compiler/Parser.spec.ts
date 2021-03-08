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
// tslint:disable: object-literal-sort-keys
import { createBrowserSystem } from "../environment";
import { createConfig } from "./Config";
import { createParser, parsePaths, Parser } from "./Parser";

const testSystem = createBrowserSystem({
    "tsconfig.json": `{}`,
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
    let parse: Parser;
    beforeEach(() => {
        const compilerOptions = createConfig("tsconfig.json", testSystem).options;
        parse = createParser({ system: testSystem, compilerOptions });
    });

    it("returns script names and no style name with direct single file input", () => {
        const actual = parse(["/one.ts"]);

        expect(actual.program.getRootFileNames()).toEqual(["/one.ts"]);
        expect(actual.stylePaths).toEqual([]);
    });

    it("returns script names and no style name with global file inputs", () => {
        const actual = parse();

        expect(actual.program.getRootFileNames()).toEqual(["src/_four.css", "src/_five.scss"]);
        expect(actual.stylePaths).toEqual(["src/_four.css", "src/_five.scss"]);
    });
});

describe("parsePaths", () => {
    const compilerOptions = createConfig("tsconfig.json", testSystem).options;
    const system = testSystem;

    it("returns scriptPaths with direct script filePaths", () => {
        const actual = parsePaths({ compilerOptions, system }, ["/one.ts", "/two.ts", "/three.js"]);

        expect(actual).toEqual({ scriptPaths: ["/one.ts", "/two.ts", "/three.js"], stylePaths: [] });
    });

    it("returns stylePaths with direct style filePaths", () => {
        const actual = parsePaths({ compilerOptions, system }, ["/one.css", "/two.scss", "/three.scss"]);

        expect(actual).toEqual({ scriptPaths: [], stylePaths: ["/one.css", "/two.scss", "/three.scss"] });
    });

    it("returns scriptPaths and stylePaths with direct filePaths", () => {
        const actual = parsePaths({ compilerOptions, system }, [
            "/one.js",
            "/two.ts",
            "/three.tsx",
            "/four.css",
            "/five.scss",
        ]);

        expect(actual).toEqual({
            scriptPaths: ["/one.js", "/two.ts", "/three.tsx"],
            stylePaths: ["/four.css", "/five.scss"],
        });
    });

    it("returns scriptPaths and stylePaths with global filePaths", () => {
        const actual = parsePaths({
            compilerOptions,
            system,
            filePaths: ["src/one.js", "src/two.ts", "src/three.tsx", "src/_four.css", "src/_five.scss"],
        });

        expect(actual).toEqual({
            scriptPaths: ["src/one.js", "src/two.ts", "src/three.tsx"],
            stylePaths: ["src/_four.css", "src/_five.scss"],
        });
    });

    it("returns scriptPaths and stylePaths with global fileNames", () => {
        const actual = parsePaths({
            compilerOptions,
            system,
            filePaths: ["one.js", "two.ts", "three.tsx", "_four.css", "_five.scss"],
        });

        expect(actual).toEqual({
            scriptPaths: ["one.js", "two.ts", "three.tsx"],
            stylePaths: ["src/_four.css", "src/_five.scss"],
        });
    });

    it("replaces scriptPaths and stylePaths with global and direct fileNames", () => {
        const actual = parsePaths(
            {
                compilerOptions,
                system,
                filePaths: ["one.js", "two.ts", "three.tsx", "_four.css", "_five.scss"],
            },
            ["zip.js", "zap.css", "zup.tsx"]
        );

        expect(actual).toEqual({
            scriptPaths: ["zip.js", "zup.tsx"],
            stylePaths: ["zap.css"],
        });
    });
});
