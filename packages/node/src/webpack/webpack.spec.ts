import fs from "fs";
import path from "path";
import { Logger } from "../Logger";
import { webpack } from "./webpack";

const TEST_TARGETS_DIR = path.join(__dirname, "..", "..", "test", "__test-targets__");

beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
});

afterEach(() => {
    fs.rmSync(path.join(__dirname, "lib"), { recursive: true, force: true });
});

describe("compile", () => {
    it("should yield success with default config and existing file path", async () => {
        const stdout = await webpack([path.join(TEST_TARGETS_DIR, "foobar-arrow.ts")], {
            webpack: {
                mode: "development",
                target: "node",
                module: {
                    rules: [
                        {
                            test: /\.ts$/,
                            loader: require.resolve("ts-loader"),
                            options: {
                                transpileOnly: true,
                            },
                        },
                    ],
                },
            },
            tsLoader: {
                compilerOptions: {
                    noEmit: true,
                },
            },
        });
        expect(stdout).toContain(""); // success
    });

    it("should yield compile error with unknown file path", async () => {
        await expect(() => webpack(["src/does-not-exist.ts"])).rejects.toThrow("Module not found: Error: Can't resolve 'src/does-not-exist.ts'");
    });
});
