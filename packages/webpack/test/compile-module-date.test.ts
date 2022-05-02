/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
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

import { readdirSync, readFileSync, rmSync } from "fs";
import { resolve } from "path";
import { Compiler, Configuration, NormalModule, Stats } from "webpack";
import { createWebpackCompiler } from "./webpack-utils";

describe("WebsmithPlugin", () => {
    const projectDir = resolve(__dirname, "__data__", "module-date");
    let config: Configuration;
    let webpack: Compiler;
    let actual: Stats;

    beforeAll(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        config = require("./__data__/module-date/webpack.config.ts") as Configuration;
    });

    beforeEach(async () => {
        const { stats, compiler } = await createWebpackCompiler(config, projectDir);
        webpack = compiler;
        actual = stats;
    });

    afterEach(() => {
        webpack.close(() => undefined);
        rmSync(resolve(projectDir, ".build"), { recursive: true, force: true });
    });

    it("yields modules", async () => {
        expect(
            Array.from(actual.compilation.modules.values())
                .filter(mod => mod instanceof NormalModule && mod.rawRequest.includes(resolve(projectDir, "src")))
                .map(mod => (mod as NormalModule).rawRequest)
        ).toEqual(expect.arrayContaining([resolve(projectDir, "src", "index.tsx"), resolve(projectDir, "src", "functions", "getDate.ts")]));
    });

    it("yields chunks", async () => {
        expect(Array.from(actual.compilation.chunks.values()).map(cur => cur.name)).toEqual(expect.arrayContaining(["functions", "main"]));
    });

    it("yields bundled output", async () => {
        expect(readdirSync(resolve(__dirname, "./__data__/module-date/.build/lib")).filter(it => it.includes("."))).toEqual([
            "functions.js",
            "functions.js.map",
            "main.js",
            "main.js.map",
            "output.yaml",
        ]);

        const expected = readFileSync(resolve(__dirname, "./__data__/module-date/.build/lib/output.yaml")).toString();
        [
            `-file: "/Users/marcschaerer/quatico/qs-websmith/packages/webpack/test/__data__/module-date/src/index.tsx"\nexports: [render]`,
            `-file: "/Users/marcschaerer/quatico/qs-websmith/packages/webpack/test/__data__/module-date/src/functions/getDate.ts"\nexports: [getDate]`,
            `-file: "/Users/marcschaerer/quatico/qs-websmith/packages/webpack/test/__data__/module-date/src/model/index.ts"\nexports: []`,
            `-file: "/Users/marcschaerer/quatico/qs-websmith/packages/webpack/test/__data__/module-date/src/model/test.ts"\nexports: [createTest]`,
        ].forEach(it => expect(expected).toContain(it));
    });

    // FIXME: Update the file correctly to verify that the generated server code matches the expectation
    // it.skip("yields updated source files with watch mode", async () => {
    //     const fileNameIn = resolve(__dirname, "./_data__/module-date/src/functions/getDate.ts");
    //     const fileNameOut = resolve(__dirname, "./__data__/module-date/.build/server-esm/getDate.js");

    //     await watch;

    //     expect(readFileSync(fileNameOut).toString()).toMatchInlineSnapshot(`
    //         "\\"use strict\\";
    //         Object.defineProperty(exports, \\"__esModule\\", { value: true });
    //         exports.getDate = void 0;
    //         // @service()
    //         const getDate = async ({}) => new Date();
    //         exports.getDate = getDate;
    //         //# sourceMappingURL=getDate.js.map"
    //     `);

    //     writeFileSync(fileNameIn, "// @service()\nexport const expected = async () => { return new Date(); }\n");
    //     watchInstance.invalidate();
    //     await new Promise(resolve => setTimeout(resolve, 1000));

    //     expect(readFileSync(fileNameOut).toString()).toMatchInlineSnapshot(`
    //         "\\"use strict\\";
    //         Object.defineProperty(exports, \\"__esModule\\", { value: true });
    //         exports.expected = void 0;
    //         // @service()
    //         const expected = async ({}) => { return new Date(); };
    //         exports.expected = expected;
    //         //# sourceMappingURL=getDate.js.map"
    //     `);
    // });
});
