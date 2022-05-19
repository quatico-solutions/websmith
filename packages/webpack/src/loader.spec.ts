/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { createOptions } from "@quatico/websmith-cli";
import { CompilerOptions } from "@quatico/websmith-compiler";
import { join, resolve } from "path";
import { Compiler, LoaderContext } from "webpack";
import { getInstanceFromCache } from "./instance-cache";
import { initializeInstance, makeSourceMap, processResultAndFinish } from "./loader";

const projectDir = resolve(__dirname, "..", "test", "__data__", "module-date");

describe("initializeInstance", () => {
    it("should create a TsCompiler instance w/o instance in cache", () => {
        const target = { _compiler: {} as Compiler } as LoaderContext<any>;

        const actual = initializeInstance(
            target,
            createOptions({ config: join(projectDir, "websmith.config.json"), project: join(projectDir, "tsconfig.json") })
        );

        expect(actual).toEqual(getInstanceFromCache(target._compiler!, target));
    });
});

describe("makeSourceMap", () => {
    it("should only provide output w/o sourceMap", () => {
        const actual = makeSourceMap("expected");

        expect(actual).toEqual({ output: "expected" });
    });

    it("should provide output, sourceMap w/ sourceMap", () => {
        const expected = { title: "expected", information: "information" };

        const actual = makeSourceMap("expected", JSON.stringify(expected));

        expect(actual).toEqual({ output: "expected", sourceMap: expected });
    });
});

describe("processResultAndFinish", () => {
    it("should report an error w/o outputText", () => {
        const testObj = { callback: jest.fn(), resourcePath: "/expected/test.ts" } as unknown as LoaderContext<any>;

        processResultAndFinish(testObj, { version: 0, files: [] }, { targets: ["expected"] } as CompilerOptions);

        expect(testObj.callback).toHaveBeenCalledWith(new Error('No processed output found for "/expected/test.ts" with targets "expected"'));
    });

    it("should yield the output and sourceMap w/ output and sourceMap files", () => {
        const expected = { title: "expected", information: "information" };
        const testObj = { callback: jest.fn(), resourcePath: "/expected/test.ts" } as unknown as LoaderContext<any>;

        processResultAndFinish(
            testObj,
            {
                version: 0,
                files: [
                    { name: "/expected/test.js", text: "expected-js-output", writeByteOrderMark: false },
                    { name: "/expected/test.js.map", text: JSON.stringify(expected), writeByteOrderMark: false },
                ],
            },
            { targets: ["expected"] } as CompilerOptions
        );

        expect(testObj.callback).toHaveBeenCalledWith(undefined, "expected-js-output", expected);
    });
});
