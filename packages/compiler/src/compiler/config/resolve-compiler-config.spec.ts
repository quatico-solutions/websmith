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
import { createBrowserSystem } from "../../environment";
import { NoReporter } from "../NoReporter";
import { resolveCompilationConfig } from "./resolve-compiler-config";

const testSystem = createBrowserSystem({});

describe("resolveCompilationConfig", () => {
    it("should return undefined w/ empty path", () => {
        const actual = resolveCompilationConfig("", new NoReporter(), testSystem);

        expect(actual).toBeUndefined();
    });

    it("should return undefined w/ non-existing path", () => {
        const actual = resolveCompilationConfig("/does-not-exists.json", new NoReporter(), testSystem);

        expect(actual).toBeUndefined();
    });

    it("should return undefined w/ existing path but invalid config file", () => {
        testSystem.writeFile("./invalid-config.json", "");
        const actual = resolveCompilationConfig("./invalid-config.json", new NoReporter(), testSystem);

        expect(actual).toBeUndefined();
    });

    it("should return defaults w/ existing path and empty config file", () => {
        testSystem.writeFile("./empty-config.json", "{}");
        const actual = resolveCompilationConfig("./empty-config.json", new NoReporter(), testSystem);

        expect(actual).toEqual({
            configFilePath: "/empty-config.json",
        });
    });
});
