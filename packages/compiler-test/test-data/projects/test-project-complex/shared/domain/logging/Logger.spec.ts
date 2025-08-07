/* eslint-disable testing-library/no-debugging-utils */
import { Logger } from "./Logger";

describe("Logger", () => {
    let testObj: Logger;
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        // Reset the max log level to debug for each test
        Logger.setMaxLogLevel("debug");

        // Spy on console methods
        consoleSpy = jest.spyOn(console, "debug").mockImplementation();
        jest.spyOn(console, "info").mockImplementation();
        jest.spyOn(console, "warn").mockImplementation();
        jest.spyOn(console, "error").mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("create", () => {
        it("should create logger with string scope", () => {
            const actual = Logger.create("TestScope");

            expect(actual).toBeInstanceOf(Logger);
            // Test that the scope is set correctly by checking debug output
            actual.debug("test message");
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[TestScope]"));
        });

        it("should create logger with class constructor scope", () => {
            class TestClass {}
            const actual = Logger.create(TestClass);

            expect(actual).toBeInstanceOf(Logger);
            // Test that the scope is set correctly by checking debug output
            actual.debug("test message");
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[TestClass]"));
        });

        it("should create logger with default scope when undefined", () => {
            const actual = Logger.create(undefined);

            expect(actual).toBeInstanceOf(Logger);
            // Test that the scope is set correctly by checking debug output
            actual.debug("test message");
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[default]"));
        });
    });

    describe("setMaxLogLevel", () => {
        it("should set max log level to debug", () => {
            Logger.setMaxLogLevel("debug");
            testObj = Logger.create("TestScope");

            testObj.debug("debug message");
            testObj.info("info message");
            testObj.warn("warn message");
            testObj.error("error message");

            expect(console.debug).toHaveBeenCalledTimes(1);
            expect(console.info).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledTimes(1);
        });

        it("should set max log level to info", () => {
            Logger.setMaxLogLevel("info");
            testObj = Logger.create("TestScope");

            testObj.debug("debug message");
            testObj.info("info message");
            testObj.warn("warn message");
            testObj.error("error message");

            expect(console.debug).not.toHaveBeenCalled();
            expect(console.info).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledTimes(1);
        });

        it("should set max log level to warn", () => {
            Logger.setMaxLogLevel("warn");
            testObj = Logger.create("TestScope");

            testObj.debug("debug message");
            testObj.info("info message");
            testObj.warn("warn message");
            testObj.error("error message");

            expect(console.debug).not.toHaveBeenCalled();
            expect(console.info).not.toHaveBeenCalled();
            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledTimes(1);
        });

        it("should set max log level to error", () => {
            Logger.setMaxLogLevel("error");
            testObj = Logger.create("TestScope");

            testObj.debug("debug message");
            testObj.info("info message");
            testObj.warn("warn message");
            testObj.error("error message");

            expect(console.debug).not.toHaveBeenCalled();
            expect(console.info).not.toHaveBeenCalled();
            expect(console.warn).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledTimes(1);
        });
    });

    describe("debug", () => {
        beforeEach(() => {
            testObj = Logger.create("TestScope");
        });

        it("should log debug message when max level is debug", () => {
            Logger.setMaxLogLevel("debug");
            const actual = "test debug message";

            testObj.debug(actual);

            expect(console.debug).toHaveBeenCalledWith(expect.stringContaining("[DEBUG]"));
            expect(console.debug).toHaveBeenCalledWith(expect.stringContaining("[TestScope]"));
            expect(console.debug).toHaveBeenCalledWith(expect.stringContaining(actual));
        });

        it("should not log debug message when max level is info", () => {
            Logger.setMaxLogLevel("info");
            const actual = "test debug message";

            testObj.debug(actual);

            expect(console.debug).not.toHaveBeenCalled();
        });

        it("should not log debug message when max level is warn", () => {
            Logger.setMaxLogLevel("warn");
            const actual = "test debug message";

            testObj.debug(actual);

            expect(console.debug).not.toHaveBeenCalled();
        });

        it("should not log debug message when max level is error", () => {
            Logger.setMaxLogLevel("error");
            const actual = "test debug message";

            testObj.debug(actual);

            expect(console.debug).not.toHaveBeenCalled();
        });
    });

    describe("info", () => {
        beforeEach(() => {
            testObj = Logger.create("TestScope");
        });

        it("should log info message when max level is debug", () => {
            Logger.setMaxLogLevel("debug");
            const actual = "test info message";

            testObj.info(actual);

            expect(console.info).toHaveBeenCalledWith(expect.stringContaining("[INFO]"));
            expect(console.info).toHaveBeenCalledWith(expect.stringContaining("[TestScope]"));
            expect(console.info).toHaveBeenCalledWith(expect.stringContaining(actual));
        });

        it("should log info message when max level is info", () => {
            Logger.setMaxLogLevel("info");
            const actual = "test info message";

            testObj.info(actual);

            expect(console.info).toHaveBeenCalledWith(expect.stringContaining("[INFO]"));
            expect(console.info).toHaveBeenCalledWith(expect.stringContaining("[TestScope]"));
            expect(console.info).toHaveBeenCalledWith(expect.stringContaining(actual));
        });

        it("should not log info message when max level is warn", () => {
            Logger.setMaxLogLevel("warn");
            const actual = "test info message";

            testObj.info(actual);

            expect(console.info).not.toHaveBeenCalled();
        });

        it("should not log info message when max level is error", () => {
            Logger.setMaxLogLevel("error");
            const actual = "test info message";

            testObj.info(actual);

            expect(console.info).not.toHaveBeenCalled();
        });
    });

    describe("warn", () => {
        beforeEach(() => {
            testObj = Logger.create("TestScope");
        });

        it("should log warn message when max level is debug", () => {
            Logger.setMaxLogLevel("debug");
            const actual = "test warn message";

            testObj.warn(actual);

            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("[WARN]"));
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("[TestScope]"));
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(actual));
        });

        it("should log warn message when max level is info", () => {
            Logger.setMaxLogLevel("info");
            const actual = "test warn message";

            testObj.warn(actual);

            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("[WARN]"));
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("[TestScope]"));
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(actual));
        });

        it("should log warn message when max level is warn", () => {
            Logger.setMaxLogLevel("warn");
            const actual = "test warn message";

            testObj.warn(actual);

            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("[WARN]"));
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("[TestScope]"));
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(actual));
        });

        it("should not log warn message when max level is error", () => {
            Logger.setMaxLogLevel("error");
            const actual = "test warn message";

            testObj.warn(actual);

            expect(console.warn).not.toHaveBeenCalled();
        });
    });

    describe("error", () => {
        beforeEach(() => {
            testObj = Logger.create("TestScope");
        });

        it("should log error message when max level is debug", () => {
            Logger.setMaxLogLevel("debug");
            const actual = "test error message";

            testObj.error(actual);

            expect(console.error).toHaveBeenCalledWith(expect.stringContaining("[ERROR]"));
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining("[TestScope]"));
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining(actual));
        });

        it("should log error message when max level is info", () => {
            Logger.setMaxLogLevel("info");
            const actual = "test error message";

            testObj.error(actual);

            expect(console.error).toHaveBeenCalledWith(expect.stringContaining("[ERROR]"));
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining("[TestScope]"));
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining(actual));
        });

        it("should log error message when max level is warn", () => {
            Logger.setMaxLogLevel("warn");
            const actual = "test error message";

            testObj.error(actual);

            expect(console.error).toHaveBeenCalledWith(expect.stringContaining("[ERROR]"));
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining("[TestScope]"));
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining(actual));
        });

        it("should log error message when max level is error", () => {
            Logger.setMaxLogLevel("error");
            const actual = "test error message";

            testObj.error(actual);

            expect(console.error).toHaveBeenCalledWith(expect.stringContaining("[ERROR]"));
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining("[TestScope]"));
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining(actual));
        });
    });

    describe("message formatting", () => {
        beforeEach(() => {
            testObj = Logger.create("TestScope");
        });

        it("should format message with timestamp, level, scope, and message", () => {
            const actual = "test message";

            testObj.info(actual);

            const expectedCall = (console.info as jest.Mock).mock.calls[0][0];

            // Check for timestamp format (ISO string)
            expect(expectedCall).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);

            // Check for log level
            expect(expectedCall).toContain("[INFO]");

            // Check for scope
            expect(expectedCall).toContain("[TestScope]");

            // Check for message
            expect(expectedCall).toContain(actual);
        });

        it("should include color codes in formatted message", () => {
            const actual = "test message";

            testObj.info(actual);

            const expectedCall = (console.info as jest.Mock).mock.calls[0][0];

            // Check for color codes (ANSI escape sequences)
            // eslint-disable-next-line no-control-regex
            expect(expectedCall).toMatch(/\x1b\[32m/); // Green color for info
            // eslint-disable-next-line no-control-regex
            expect(expectedCall).toMatch(/\x1b\[0m/); // Reset color
        });
    });

    describe("integration scenarios", () => {
        it("should handle multiple log levels in sequence", () => {
            testObj = Logger.create("IntegrationTest");
            Logger.setMaxLogLevel("debug");

            testObj.debug("debug message");
            testObj.info("info message");
            testObj.warn("warn message");
            testObj.error("error message");

            expect(console.debug).toHaveBeenCalledTimes(1);
            expect(console.info).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledTimes(1);
        });

        it("should handle changing log levels during runtime", () => {
            testObj = Logger.create("DynamicTest");

            // Start with debug level
            Logger.setMaxLogLevel("debug");
            testObj.debug("debug message 1");
            testObj.info("info message 1");

            // Change to warn level
            Logger.setMaxLogLevel("warn");
            testObj.debug("debug message 2");
            testObj.info("info message 2");
            testObj.warn("warn message");

            // Change to error level
            Logger.setMaxLogLevel("error");
            testObj.debug("debug message 3");
            testObj.info("info message 3");
            testObj.warn("warn message 2");
            testObj.error("error message");

            expect(console.debug).toHaveBeenCalledTimes(1);
            expect(console.info).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledTimes(1);
        });
    });
});
