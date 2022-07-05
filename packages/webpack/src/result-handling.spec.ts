/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { LoaderContext } from "webpack";
import { makeSourceMap, processResultAndFinish } from "./result-handling";

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

        processResultAndFinish(testObj, { version: 0, files: [] }, ["expected"]);

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
            ["expected"]
        );

        expect(testObj.callback).toHaveBeenCalledWith(undefined, "expected-js-output", expected);
    });
});
