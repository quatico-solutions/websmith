import { parseReasonFromConsole } from "./console-output";

describe("parseReasonFromConsole", () => {
    it("should return reason with single line value in stdout and stderr", () => {
        const stdout = "error: whatever";
        const stderr = "error: expected";

        expect(parseReasonFromConsole(stdout, stderr)).toBe("error: expected");
    });

    it("should return reason with single line value in stdout", () => {
        const stdout = "error: expected";
        const stderr = "";

        expect(parseReasonFromConsole(stdout, stderr)).toBe("error: expected");
    });

    it("should return reason with single line value in stderr", () => {
        const stdout = "";
        const stderr = "error: expected";

        expect(parseReasonFromConsole(stdout, stderr)).toBe("error: expected");
    });

    it("should return null if no error is found", () => {
        const stdout = "whatever";
        const stderr = "whatever";

        expect(parseReasonFromConsole(stdout, stderr)).toBeNull();
    });

    it("should return null with multi-line value in stderr and no error in first line", () => {
        const stdout = "whatever";
        const stderr = "whatever\nerror: target\nwhatever";

        expect(parseReasonFromConsole(stdout, stderr)).toBeNull();
    });

    it("should return null with multi-line value in stdout and no error in first line", () => {
        const stdout = "whatever\nerror: target\nwhatever";
        const stderr = "whatever";

        expect(parseReasonFromConsole(stdout, stderr)).toBeNull();
    });
});
