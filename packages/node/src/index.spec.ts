/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
describe("index", () => {
    it("should check typescript before loading it", () => {
        jest.doMock("@quatico/websmith-core/lib/check-typescript", () => ({
            checkTypeScript: () => {
                throw new Error("checked first");
            },
        }));
        jest.doMock("typescript", () => {
            throw new Error("typescript loaded first");
        });

        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const actual = () => jest.isolateModules(() => require("./index") as unknown);

        expect(actual).toThrow("checked first");
    });
});
