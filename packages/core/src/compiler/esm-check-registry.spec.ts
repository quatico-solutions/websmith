/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type * as Registry from "./esm-check-registry";
import { collectEsmChecks, recordEsmCheck } from "./esm-check-registry";

const KEY = Symbol.for("@quatico/websmith-core/esm-check");

const loadIsolated = (): typeof Registry => {
    let result: typeof Registry | undefined;
    jest.isolateModules(() => {
        result = jest.requireActual("./esm-check-registry");
    });
    return result!;
};

describe("collectEsmChecks", () => {
    it("yields recorded file w/ check inside window", () => {
        const actual = collectEsmChecks(() => recordEsmCheck({ path: "/out/target.js", text: "whatever" }));

        expect(actual).toEqual([{ path: "/out/target.js", text: "whatever" }]);
    });

    it("yields no file w/ check before window", () => {
        recordEsmCheck({ path: "/out/target.js", text: "whatever" });

        const actual = collectEsmChecks(() => undefined);

        expect(actual).toEqual([]);
    });

    it("yields file in outer window w/ check inside nested window", () => {
        const actual = collectEsmChecks(() => collectEsmChecks(() => recordEsmCheck({ path: "/out/target.js", text: "whatever" })));

        expect(actual).toEqual([{ path: "/out/target.js", text: "whatever" }]);
    });

    it("yields recorded file w/ check by other module instance", () => {
        const other = loadIsolated();

        const actual = collectEsmChecks(() => other.recordEsmCheck({ path: "/out/target.js", text: "whatever" }));

        expect(actual).toEqual([{ path: "/out/target.js", text: "whatever" }]);
    });

    it("yields recorded file in other module instance w/ check by this instance", () => {
        const testObj = loadIsolated();

        const actual = testObj.collectEsmChecks(() => recordEsmCheck({ path: "/out/target.js", text: "whatever" }));

        expect(actual).toEqual([{ path: "/out/target.js", text: "whatever" }]);
    });

    it("leaves no global state w/ window closed", () => {
        collectEsmChecks(() => recordEsmCheck({ path: "/out/target.js", text: "whatever" }));

        const actual = Object.getOwnPropertySymbols(globalThis);

        expect(actual).not.toContain(KEY);
    });

    it("leaves no global state w/ throwing function", () => {
        expect(() =>
            collectEsmChecks(() => {
                throw new Error("whatever");
            })
        ).toThrow("whatever");

        const actual = Object.getOwnPropertySymbols(globalThis);

        expect(actual).not.toContain(KEY);
    });

    it("yields no file in outer window w/ check after throwing nested window closed", () => {
        const actual = collectEsmChecks(() => {
            expect(() =>
                collectEsmChecks(() => {
                    throw new Error("whatever");
                })
            ).toThrow("whatever");
        });

        expect(actual).toEqual([]);
        expect(Object.getOwnPropertySymbols(globalThis)).not.toContain(KEY);
    });
});
