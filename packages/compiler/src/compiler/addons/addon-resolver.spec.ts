/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/* eslint-disable jest/no-mocks-import */
import path from "path";
import { ReporterMock } from "../../../test";
import { createBrowserSystem } from "../../environment";
import { createResolver } from "./addon-resolver";

beforeAll(() => {
    jest.mock(path.normalize(`${__dirname}/../addons/one/addon`), () => ({ activate: () => undefined }), {
        virtual: true,
    });

    jest.mock(
        path.normalize(`${__dirname}/../addons/DESNOTEXIST/addon`),
        () => {
            throw new Error();
        },
        { virtual: true }
    );
});

const testSystem = createBrowserSystem({});
testSystem.readDirectory = jest.fn().mockReturnValue(["one"]);

describe("createResolver", () => {
    it("reads addon.ts files from existing addon folder", () => {
        const resolve = createResolver(new ReporterMock(testSystem), testSystem);

        const actual = resolve(["one"]);

        expect(actual[0].activate).toEqual(expect.any(Function));
        expect(actual[0].name).toBe("one");
        expect(actual).toHaveLength(1);
    });

    it("returns empty array for non-existing addon name", () => {
        const resolve = createResolver(new ReporterMock(testSystem), testSystem);

        const actual = resolve(["DOESNOTEXIST"]);

        expect(actual).toEqual([]);
    });

    it("returns only addons for existing names", () => {
        const resolve = createResolver(new ReporterMock(testSystem), testSystem);

        const actual = resolve(["DOESNOTEXIST", "one"]);

        expect(actual[0].activate).toEqual(expect.any(Function));
        expect(actual[0].name).toBe("one");
        expect(actual).toHaveLength(1);
    });

    it("reports use of unknown addon names", () => {
        const target = new ReporterMock(testSystem);
        const resolve = createResolver(target, testSystem);

        resolve(["DOESNOTEXIST"]);

        expect(target.message).toBe(`Warning: Couldn't find addon with name "DOESNOTEXIST".\n`);
    });
});
