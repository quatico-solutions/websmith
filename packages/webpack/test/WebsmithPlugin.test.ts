import { lstatSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";
import { Configuration } from "webpack";
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
    it.todo("should bundle the target configured as webpackTarget");

    it("should bundle the first target w/ writeFile false w/o webpackTarget set", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");
        const { compiler } = await createWebpackCompiler(
            { ...require("./__data__/module-date/webpack_noWebpackTarget.config.ts"), watch: true },
            projectDir
        );

        expect(lstatSync(target).isFile()).toBe(true); 

        compiler.close(() => undefined);
    });

    it.todo("should write an error if no target w/ writeFile false is specified");

    it.todo("should write a warning if more than one target w/ writeFile false is specified");

    it("should rebundle the file in watch mode w/ the file content change", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");
        const { compiler } = await createWebpackCompiler({ ...config, watch: true }, projectDir);

        const expected = lstatSync(resolve(projectDir, ".build", "lib", "main.js")).mtimeMs;

        writeFileSync(target, readFileSync(target).toString());

        expect(lstatSync(resolve(projectDir, ".build", "lib", "main.js")).mtimeMs).toBeGreaterThan(expected);

        compiler.close(() => undefined);
    });
});
