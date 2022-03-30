/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
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
import { writeFileSync } from "fs";
import { createOptions } from "./options";

describe("createOptions", () => {
    it("should return defaults w/o any param", () => {
        const actual = createOptions({});

        expect(actual).toEqual(expect.objectContaining({ config: {}, debug: false, sourceMap: false, targets: [], watch: false }));
    });

    it("should return expected path w/ custom tsconfig", () => {
        writeFileSync("expected/tsconfig.json", "{}");

        const actual = createOptions({ project: "./expected/tsconfig.json" }).tsconfig;

        expect(actual).toEqual({
            configFilePath: expect.stringContaining("/expected/tsconfig.json"),
            outDir: "./lib",
        });
    });

    it("should return expected path w/ custom addons directory", () => {
        writeFileSync("../expected/addon-foo/addon.ts", 'export const activate = ctx => { ctx.registerTransformer("before", () => node => node); };');

        const actual = createOptions({ addons: "../expected/" }).addons.getAddons();

        expect(actual).toEqual({});
    });

    it("should return debug path w/ debug true", () => {
        const actual = createOptions({ debug: true });

        expect(actual).toEqual(expect.objectContaining({ debug: true }));
    });

    it("should return watch path w/ watch true", () => {
        const actual = createOptions({ watch: true });

        expect(actual).toEqual(expect.objectContaining({ watch: true }));
    });

    it("should return config w/ valid compiler config json", () => {
        writeFileSync("websmith.config.json", '{ "target": { "addons": [ "one", "two", "three" ], "writeFile": true } }');

        const actual = createOptions({ config: "./websmith.config.json" }).config;

        expect(actual).toEqual({ target: { addons: ["one", "two", "three"], writeFile: true } });
    });

    it("should return config w/ valid compiler config json", () => {
        writeFileSync("websmith.config.json", '{ "target": { "addons": [ "one", "two", "three" ], "writeFile": true } }');

        const actual = createOptions({ config: "./websmith.config.json" }).config;

        expect(actual).toEqual({ target: { addons: ["one", "two", "three"], writeFile: true } });
    });
});
