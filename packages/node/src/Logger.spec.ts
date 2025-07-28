/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from "./Logger";

describe("Logger", () => {
    beforeEach(() => {
        // Mock Date.toISOString to return a consistent timestamp for testing
        jest.spyOn(Date.prototype, "toISOString").mockReturnValue("2023-01-01T00:00:00.000Z");
        // Disable colors for consistent testing
        process.stdout.isTTY = false;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should log messages", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        new Logger().log("expected");

        expect(process.stdout.write).toHaveBeenCalledWith("[2023-01-01T00:00:00.000Z] [INFO] expected\n");
    });

    it("should log messages with optional params", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        new Logger().log("expected", "param");
        expect(process.stdout.write).toHaveBeenCalledWith('[2023-01-01T00:00:00.000Z] [INFO] expected ["param"]\n');
    });

    it("should log error messages", () => {
        jest.spyOn(process.stderr, "write").mockImplementation(() => true);

        new Logger().error("expected");
        expect(process.stderr.write).toHaveBeenCalledWith("[2023-01-01T00:00:00.000Z] [ERROR] expected\n");
    });

    it("should log error messages with optional params", () => {
        jest.spyOn(process.stderr, "write").mockImplementation(() => true);

        new Logger().error("expected", "param");
        expect(process.stderr.write).toHaveBeenCalledWith('[2023-01-01T00:00:00.000Z] [ERROR] expected ["param"]\n');
    });

    it("should log warn messages", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        new Logger().warn("expected");
        expect(process.stdout.write).toHaveBeenCalledWith("[2023-01-01T00:00:00.000Z] [WARN] expected\n");
    });

    it("should log warn messages with optional params", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        new Logger().warn("expected", "param");
        expect(process.stdout.write).toHaveBeenCalledWith('[2023-01-01T00:00:00.000Z] [WARN] expected ["param"]\n');
    });

    it("should log info messages", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        new Logger().info("expected");
        expect(process.stdout.write).toHaveBeenCalledWith("[2023-01-01T00:00:00.000Z] [INFO] expected\n");
    });

    it("should log info messages with optional params", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        new Logger().info("expected", "param");
        expect(process.stdout.write).toHaveBeenCalledWith('[2023-01-01T00:00:00.000Z] [INFO] expected ["param"]\n');
    });

    it("should not log debug messages when debug is disabled", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        new Logger(false).debug("expected");

        expect(process.stdout.write).not.toHaveBeenCalled();
    });

    it("should log debug messages when debug is enabled", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        new Logger(true).debug("expected");

        expect(process.stdout.write).toHaveBeenCalledWith("[2023-01-01T00:00:00.000Z] [DEBUG] expected\n");
    });

    it("should log debug messages with optional params when debug is enabled", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        new Logger(true).debug("expected", "param");

        expect(process.stdout.write).toHaveBeenCalledWith('[2023-01-01T00:00:00.000Z] [DEBUG] expected ["param"]\n');
    });

    it("should enable debug logging after construction", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        const logger = new Logger(false);
        logger.setDebugEnabled(true);
        logger.debug("expected");

        expect(process.stdout.write).toHaveBeenCalledWith("[2023-01-01T00:00:00.000Z] [DEBUG] expected\n");
    });

    it("should disable debug logging after construction", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        const logger = new Logger(true);
        logger.setDebugEnabled(false);
        logger.debug("expected");

        expect(process.stdout.write).not.toHaveBeenCalled();
    });

    it("should enable colors by default when stdout is TTY", () => {
        const originalIsTTY = process.stdout.isTTY;
        process.stdout.isTTY = true;

        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        new Logger().info("expected");

        // In test environments, colors are disabled, so expect non-colored format
        expect(process.stdout.write).toHaveBeenCalledWith("[2023-01-01T00:00:00.000Z] [INFO] expected\n");

        process.stdout.isTTY = originalIsTTY;
    });

    it("should disable colors when stdout is not TTY", () => {
        const originalIsTTY = process.stdout.isTTY;
        process.stdout.isTTY = false;

        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        new Logger().info("expected");

        expect(process.stdout.write).toHaveBeenCalledWith("[2023-01-01T00:00:00.000Z] [INFO] expected\n");

        process.stdout.isTTY = originalIsTTY;
    });

    it("should allow manual color control", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        const logger = new Logger();
        logger.setColorEnabled(false);
        logger.info("expected");

        expect(process.stdout.write).toHaveBeenCalledWith("[2023-01-01T00:00:00.000Z] [INFO] expected\n");
    });

    it("should use different colors for different log levels", () => {
        const originalIsTTY = process.stdout.isTTY;
        process.stdout.isTTY = true;

        jest.spyOn(process.stdout, "write").mockImplementation(() => true);
        jest.spyOn(process.stderr, "write").mockImplementation(() => true);

        const logger = new Logger(true);

        logger.debug("debug message");
        logger.info("info message");
        logger.warn("warn message");
        logger.error("error message");

        // In test environments, colors are disabled, so expect non-colored format
        expect(process.stdout.write).toHaveBeenNthCalledWith(1, "[2023-01-01T00:00:00.000Z] [DEBUG] debug message\n");
        expect(process.stdout.write).toHaveBeenNthCalledWith(2, "[2023-01-01T00:00:00.000Z] [INFO] info message\n");
        expect(process.stdout.write).toHaveBeenNthCalledWith(3, "[2023-01-01T00:00:00.000Z] [WARN] warn message\n");
        expect(process.stderr.write).toHaveBeenCalledWith("[2023-01-01T00:00:00.000Z] [ERROR] error message\n");

        process.stdout.isTTY = originalIsTTY;
    });
});
