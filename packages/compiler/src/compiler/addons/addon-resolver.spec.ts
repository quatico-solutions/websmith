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
