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
import { Configuration, NormalModule } from "webpack";
import { createWebpackCompiler } from "./webpack-utils";

describe("project bundling", () => {
    const projectDir = resolve(__dirname, "__data__", "module-date");
    let config: Configuration;

    beforeAll(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        config = require("./__data__/module-date/webpack.config.ts") as Configuration;
    });

    afterEach(() => {
        rmSync(resolve(projectDir, ".build"), { recursive: true, force: true });
    });

    it("yields modules", async () => {
        const { stats, compiler } = await createWebpackCompiler(config, projectDir);

        expect(
            Array.from(stats!.compilation.modules.values())
                .filter(mod => mod instanceof NormalModule && mod.rawRequest.includes(resolve(projectDir, "src")))
                .map(mod => (mod as NormalModule).rawRequest)
        ).toEqual(expect.arrayContaining([resolve(projectDir, "src", "index.tsx"), resolve(projectDir, "src", "functions", "getDate.ts")]));

        compiler.close(() => undefined);
    });

    it("yields chunks", async () => {
        const { stats, compiler } = await createWebpackCompiler(config, projectDir);

        expect(Array.from(stats!.compilation.chunks.values()).map(cur => cur.name)).toEqual(expect.arrayContaining(["functions", "main"]));

        compiler.close(() => undefined);
    });

    it("yields bundled output", async () => {
        const { compiler } = await createWebpackCompiler(config, projectDir);

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

        compiler.close(() => undefined);
    });
});
