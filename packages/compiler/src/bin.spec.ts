/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import * as commandModule from "./command";

// Mock the command module to avoid actual compilation during tests
jest.mock("./command", () => ({
    addCompileCommand: jest.fn().mockReturnValue({
        parse: jest.fn(),
    }),
}));

const mockedAddCompileCommand = commandModule.addCompileCommand as jest.MockedFunction<typeof commandModule.addCompileCommand>;

let originalArgv: string[];
let mockParse: jest.Mock;

beforeEach(() => {
    // Store original process.argv
    originalArgv = process.argv;

    // Create a mock parse function
    mockParse = jest.fn();
    mockedAddCompileCommand.mockReturnValue({
        parse: mockParse,
    } as any);

    // Clear all mocks
    jest.clearAllMocks();
});

afterEach(() => {
    // Restore original process.argv
    process.argv = originalArgv;
});

describe("bin.ts", () => {
    it("should create Command instance and call addCompileCommand", async () => {
        // Mock process.argv for this test
        process.argv = ["node", "bin.ts", "--help"];

        // Import bin.ts to execute the script
        await jest.isolateModulesAsync(async () => {
            await import("./bin");
        });

        // Verify that addCompileCommand was called with a Command instance
        expect(mockedAddCompileCommand).toHaveBeenCalledTimes(1);
        expect(mockedAddCompileCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.any(Array),
                commands: expect.any(Array),
            })
        );
    });

    it("should parse process.argv", async () => {
        const testArgs = ["node", "bin.ts", "--debug", "--watch"];
        process.argv = testArgs;

        await jest.isolateModulesAsync(async () => {
            await import("./bin");
        });

        // Verify that parse was called with process.argv
        expect(mockParse).toHaveBeenCalledTimes(1);
        expect(mockParse).toHaveBeenCalledWith(testArgs);
    });

    it("should handle compilation arguments", async () => {
        const testArgs = ["node", "bin.ts", "--project", "./tsconfig.json", "--sourceMap"];
        process.argv = testArgs;

        await jest.isolateModulesAsync(async () => {
            await import("./bin");
        });

        expect(mockedAddCompileCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.any(Array),
                commands: expect.any(Array),
            })
        );
        expect(mockParse).toHaveBeenCalledWith(testArgs);
    });

    it("should handle addon-related arguments", async () => {
        const testArgs = ["node", "bin.ts", "--addons", "foo,bar", "--addonsDir", "./custom-addons"];
        process.argv = testArgs;

        await jest.isolateModulesAsync(async () => {
            await import("./bin");
        });

        expect(mockedAddCompileCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.any(Array),
                commands: expect.any(Array),
            })
        );
        expect(mockParse).toHaveBeenCalledWith(testArgs);
    });

    it("should handle empty arguments", async () => {
        process.argv = ["node", "bin.ts"];

        await jest.isolateModulesAsync(async () => {
            await import("./bin");
        });

        expect(mockedAddCompileCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.any(Array),
                commands: expect.any(Array),
            })
        );
        expect(mockParse).toHaveBeenCalledWith(["node", "bin.ts"]);
    });

    it("should handle unknown arguments", async () => {
        const testArgs = ["node", "bin.ts", "--unknown", "--another-unknown"];
        process.argv = testArgs;

        await jest.isolateModulesAsync(async () => {
            await import("./bin");
        });

        expect(mockedAddCompileCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.any(Array),
                commands: expect.any(Array),
            })
        );
        expect(mockParse).toHaveBeenCalledWith(testArgs);
    });
});

describe("bin.ts --help", () => {
    it("should handle help message", async () => {
        process.argv = ["node", "bin.ts", "--help"];

        await jest.isolateModulesAsync(async () => {
            await import("./bin");
        });

        // Verify that addCompileCommand was called with a Command instance
        expect(mockedAddCompileCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.any(Array),
                commands: expect.any(Array),
            })
        );

        // Verify that parse was called with the help argument
        expect(mockParse).toHaveBeenCalledWith(["node", "bin.ts", "--help"]);
    });
});
