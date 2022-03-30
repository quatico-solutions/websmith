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
 * accordance with the terms of the license agresent you entered into
 * with Quatico.
 */
/* eslint-disable no-console */

import { Command } from "commander";
import { writeFileSync } from "fs";
import { Compiler } from "../compiler";
import { addCompileCommand } from "./command";
import { createOptions } from "./options";

describe("addCompileCommand", () => {
    it("should set the default options w/o any config", () => {
        const target = new Compiler(createOptions({}));

        addCompileCommand(new Command(), target).parse(["compile"], { from: "user" });

        const actual = target.getOptions();

        expect(actual.addons).toBe("./addons");
        expect(actual.config).toBe("./websmith.config.json");
        expect(actual.debug).toBe(false);
        expect(actual.project).toBe("./tsconfig.json");
        expect(actual.reporter).toBeDefined();
        expect(actual.sourceMap).toBe(false);
        expect(actual.targets).toBe([]);
        expect(actual.watch).toBe(false);
    });

    it("should set target  w/ single target cli argument", () => {
        const target = new Compiler(createOptions({}));

        addCompileCommand(new Command(), target).parse(["expected"], { from: "user" });

        expect(target.getOptions().targets).toBe(["expected"]);
    });

    it("should set target  w/ comma separated target cli argument", () => {
        const target = new Compiler(createOptions({}));

        addCompileCommand(new Command(), target).parse(["one, two, three"], { from: "user" });

        expect(target.getOptions().targets).toBe(["one", "two", "three"]);
    });

    it("should set addons option  w/ --addons cli argument", () => {
        const target = new Compiler(createOptions({}));

        addCompileCommand(new Command(), target).parse(["--addons", "expected"], { from: "user" });

        expect(target.getOptions().addons).toBe("expected");
    });

    it("should set config option  w/ --config cli argument", () => {
        writeFileSync("expected/websmith.config.json", "{}");
        const target = new Compiler(createOptions({}));

        addCompileCommand(new Command(), target).parse(["--config", "expected/websmith.config.json"], { from: "user" });

        expect(target.getOptions().project).toBe("expected/websmith.config.json");
    });

    it("should set project option  w/ --project cli argument", () => {
        writeFileSync("expected/tsconfig.json", "{}");
        const target = new Compiler(createOptions({}));

        addCompileCommand(new Command(), target).parse(["--project", "expected/tsconfig.json"], { from: "user" });

        expect(target.getOptions().project).toBe("expected/tsconfig.json");
    });

    it("should set sourceMap option  w/ --sourceMap cli argument", () => {
        const target = new Compiler(createOptions({}));

        addCompileCommand(new Command(), target).parse(["--sourceMap"], { from: "user" });

        expect(target.getOptions().sourceMap).toBe(true);
    });

    it("should set debug compiler option  w/ --debug cli argument", () => {
        const target = new Compiler(createOptions({}));

        addCompileCommand(new Command(), target).parse(["--debug"], { from: "user" });

        expect(target.getOptions().debug).toBe(true);
    });

    it("should set watch compiler option  w/ --watch cli argument", () => {
        const target = new Compiler(createOptions({}));

        addCompileCommand(new Command(), target).parse(["--watch"], { from: "user" });

        expect(target.getOptions().watch).toBe(true);
    });

    it("should execute compile w/o --watch cli argument", () => {
        const target = new Compiler(createOptions({}));
        target.compile = jest.fn();

        addCompileCommand(new Command(), target).parse([], { from: "user" });

        expect(target.compile).toHaveBeenCalled();
    });

    it("should inform CLI user about tsconfig usage for unsupported command line arguments", () => {
        console.error = line => {
            throw new Error(line.toString());
        };
        const target = new Compiler(createOptions({}));

        expect(() => addCompileCommand(new Command(), target).parse(["compile", "--debug", "--allowJs", "--strict"], { from: "user" })).toThrow(
            `Unknown Argument "--allowJs".` + `\nIf this is a tsc command, please configure it in your typescript configuration file.\n`
        );
    });
});
