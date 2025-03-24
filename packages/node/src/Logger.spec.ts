/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from "./Logger";

describe("Logger", () => {
    it("should log messages", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        new Logger("target").log("expected");

        expect(process.stdout.write).toHaveBeenCalledWith("target expected\n");
    });

    it("should log messages with optional params", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        new Logger("target").log("expected", "param");
        expect(process.stdout.write).toHaveBeenCalledWith('target expected ["param"]\n');
    });

    it("should log error messages", () => {
        jest.spyOn(process.stderr, "write").mockImplementation(() => true);

        new Logger("target").error("expected");
        expect(process.stderr.write).toHaveBeenCalledWith("target expected\n");
    });

    it("should log error messages with optional params", () => {
        jest.spyOn(process.stderr, "write").mockImplementation(() => true);

        new Logger("target").error("expected", "param");
        expect(process.stderr.write).toHaveBeenCalledWith('target expected ["param"]\n');
    });

    it("should log warn messages", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        new Logger("target").warn("expected");
        expect(process.stdout.write).toHaveBeenCalledWith("target expected\n");
    });

    it("should log warn messages with optional params", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        new Logger("target").warn("expected", "param");
        expect(process.stdout.write).toHaveBeenCalledWith('target expected ["param"]\n');
    });
});
