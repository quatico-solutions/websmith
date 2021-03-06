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
    "tsconfig.json": `{
        include: ["src"]
    }`,
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

        expect(actual.program.getRootFileNames()).toEqual([]);
        expect(actual.stylePaths).toEqual(["src/_four.css", "src/_five.scss"]);
    });
});

describe("parsePaths", () => {
    const options = { system: testSystem, compilerOptions: createConfig("tsconfig.json", testSystem).options };

    it("returns scriptPaths array with input script paths", () => {
        const actual = parsePaths(options, ["/one.ts", "/two.ts", "/three.js"]);

        expect(actual).toEqual({ scriptPaths: ["/one.ts", "/two.ts", "/three.js"], stylePaths: [] });
    });

    it("returns scriptPaths array with input script paths", () => {
        const actual = parsePaths(options, ["/one.ts", "/two.ts", "/three.js"]);

        expect(actual).toEqual({ scriptPaths: ["/one.ts", "/two.ts", "/three.js"], stylePaths: [] });
    });

    it("returns stylePaths array with input style paths", () => {
        const actual = parsePaths(options, ["/one.css", "/two.scss", "/three.scss"]);

        expect(actual).toEqual({ scriptPaths: [], stylePaths: ["/one.css", "/two.scss", "/three.scss"] });
    });

    it("returns separated scriptPaths and stylePaths with scripts and styles input", () => {
        const actual = parsePaths(options, ["/one.js", "/two.ts", "/three.tsx", "/four.css", "/five.scss"]);

        expect(actual).toEqual({
            scriptPaths: ["/one.js", "/two.ts", "/three.tsx"],
            stylePaths: ["/four.css", "/five.scss"],
        });
    });

    it("returns separated scriptPaths and stylePaths with tsconfig.json input", () => {
        const actual = parsePaths(options);

        expect(actual).toEqual({
            scriptPaths: ["src/two.ts", "src/three.tsx", "src/seven.ts"],
            stylePaths: ["src/_four.css", "src/_five.scss"],
        });
    });
});
