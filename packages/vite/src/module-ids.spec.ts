/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { isCompiledId } from "./module-ids";

const acceptAll = (): boolean => true;

describe("isCompiledId", () => {
    it("should return false w/ virtual module id", () => {
        const actual = isCompiledId("\0virtual:a.ts", acceptAll);

        expect(actual).toBe(false);
    });

    it.each(["?raw", "?url", "?worker", "?inline", "?vue&type=script&lang.ts"])("should return false w/ query %s", query => {
        const actual = isCompiledId(`/project/src/a.ts${query}`, acceptAll);

        expect(actual).toBe(false);
    });

    it.each([".ts", ".tsx", ".mts", ".cts"])("should return true w/ plain %s id accepted by filter", extension => {
        const actual = isCompiledId(`/project/src/a${extension}`, acceptAll);

        expect(actual).toBe(true);
    });

    it("should return false w/ id rejected by filter", () => {
        const actual = isCompiledId("/project/src/a.ts", () => false);

        expect(actual).toBe(false);
    });

    it("should pass id to filter w/ plain id", () => {
        const target = jest.fn().mockReturnValue(true);

        isCompiledId("/project/src/a.ts", target);

        expect(target).toHaveBeenCalledWith("/project/src/a.ts");
    });
});
