/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { webpack } from "@quatico/websmith-node";
import { readdirSync, readFileSync, rmSync } from "fs";
import { resolve } from "path";
import { type Configuration } from "webpack";

// FIXME: This test is not working, we need valid entries
describe.skip("project bundling", () => {
    const projectDir = resolve(__dirname, "../__data__/module-test");
    let config: Configuration;

    beforeAll(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        config = require("../__data__/module-test/webpack.config.js")() as Configuration;
    });

    afterEach(() => {
        rmSync(resolve(projectDir, ".build"), { recursive: true, force: true });
    });

    it("yields bundled output", async () => {
        await webpack([], { webpack: config });

        expect(readdirSync(resolve(__dirname, "../__data__/module-test/.build/lib"))).toEqual([
            "functions.js",
            "functions.js.map",
            "main.js",
            "main.js.map",
            "output.yaml",
        ]);

        const expected = readFileSync(resolve(__dirname, "../__data__/module-test/.build/lib/output.yaml")).toString();
        [
            `-file: "${resolve(__dirname, "../__data__/module-test/src/index.tsx")}"\nexports: [render]`,
            `-file: "${resolve(__dirname, "../__data__/module-test/src/functions/getDate.ts")}"\nexports: [getDate]`,
            `-file: "${resolve(__dirname, "../__data__/module-test/src/model/index.ts")}"\nexports: []`,
            `-file: "${resolve(__dirname, "../__data__/module-test/src/model/create-message.ts")}"\nexports: [createMessage]`,
        ].forEach(it => expect(expected).toContain(it));
    });
});
