/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { compilationEnv } from "@quatico/websmith-testing";
import path from "node:path";

// compilationEnv compiles addons with websmith's own options; on TypeScript 6 a deprecated value (target es5, moduleResolution node10) is TS5107
describe("compile an addon w/ compilationEnv", () => {
    it("compiles an addon project without deprecation errors from websmith's own options", () => {
        const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
        const stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
        const testObj = compilationEnv("__TEST__");

        testObj.addAddon("foo-addon", path.join(__dirname, "../test-data/addons"));
        const actual = {
            addons: testObj.getActiveAddons().getNames(),
            output: [...stdout.mock.calls, ...stderr.mock.calls].map(cur => String(cur[0])).join(""),
        };

        expect(actual.addons).toContain("foo-addon");
        expect(actual.output).not.toMatch(/5107/);
    }, 60000);
});
