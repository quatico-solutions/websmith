import { lstatSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";
import { Configuration } from "webpack";
import { WebsmithPlugin } from "../src";
import { createWebpackCompiler } from "./webpack-utils";

const projectDir = resolve(__dirname, "__data__", "module-date");
let config: Configuration;

beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    config = require("./__data__/module-date/webpack.config.ts") as Configuration;
});

afterEach(() => {
    rmSync(resolve(projectDir, ".build"), { recursive: true, force: true });
});

describe("WebsmithPlugin", () => {
    it("should be a function", () => {
        expect(WebsmithPlugin).toBeInstanceOf(Function);
    });

    it.todo("executes loader only once per file");

    it("recompiles the file w/ the file content change in watch mode", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");
        const { compiler } = await createWebpackCompiler({ ...config, watch: true }, projectDir);

        const expected = lstatSync(resolve(projectDir, ".build", "lib", "main.js")).mtimeMs;

        writeFileSync(target, readFileSync(target).toString());

        expect(lstatSync(resolve(projectDir, ".build", "lib", "main.js")).mtimeMs).toBeGreaterThan(expected);

        compiler.close(() => undefined);
    });
});
