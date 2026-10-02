/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { compile } from "@quatico/websmith-node";
import fs from "node:fs";
import path from "node:path";

// Neither side sets target or esModuleInterop: TypeScript derives both from module
const SOURCES: Record<string, string> = {
    "def.ts": `const def = { value: 1 };\nexport default def;\nexport const x = 1;\n`,
    "index.ts": [
        `import def from "./def.js";`,
        `export const value = def.value;`,
        `export const load = async () => {`,
        `    const mod = await import("./def.js");`,
        `    return mod.x;`,
        `};`,
        `export class Point {`,
        `    x = 1;`,
        `    y: number;`,
        `    constructor(y: number) {`,
        `        this.y = y;`,
        `    }`,
        `}`,
        ``,
    ].join("\n"),
    "dynamic.mts": `export const loadDef = () => import("./def.js");\n`,
};

let projectDir: string;

beforeEach(() => {
    projectDir = fs.mkdtempSync(path.resolve(__dirname, "..", "test-output-tsc-defaults-"));
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "package.json"), JSON.stringify({ name: "tsc-defaults", private: true }));
    jest.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
});

const writeSources = (sources: Record<string, string>): string[] =>
    Object.entries(sources).map(([name, content]) => {
        const filePath = path.join(projectDir, "src", name);
        fs.writeFileSync(filePath, content);
        return filePath;
    });

const readOutput = (outDir: string, filter: (name: string) => boolean = () => true): Record<string, string> => {
    if (!fs.existsSync(outDir)) {
        return {};
    }
    return Object.fromEntries(
        fs
            .readdirSync(outDir, { recursive: true, encoding: "utf-8" })
            .filter(name => fs.statSync(path.join(outDir, name)).isFile() && filter(name))
            .sort()
            .map(name => [name.split(path.sep).join("/"), fs.readFileSync(path.join(outDir, name), "utf-8")])
    );
};

const isJavaScript = (name: string) => /\.[cm]?jsx?$/.test(name);

// The project's tsconfig.json sets module and leaves target and esModuleInterop unset; tsc gets the same one with its own outDir
const writeTsConfig = (files: string[], compilerOptions: Record<string, unknown>): string => {
    const tsConfigFile = path.join(projectDir, "tsconfig.json");
    fs.writeFileSync(
        tsConfigFile,
        JSON.stringify({ compilerOptions: { declaration: true, outDir: "websmith", rootDir: "src", skipLibCheck: true, ...compilerOptions }, files })
    );
    fs.writeFileSync(path.join(projectDir, "tsconfig.tsc.json"), JSON.stringify({ extends: "./tsconfig.json", compilerOptions: { outDir: "tsc" } }));
    return tsConfigFile;
};

const compileTsc = async (filter?: (name: string) => boolean): Promise<Record<string, string>> => {
    await compile([], { tsConfig: { project: path.join(projectDir, "tsconfig.tsc.json") } });
    return readOutput(path.join(projectDir, "tsc"), filter);
};

const compileWebsmith = async (
    files: string[],
    tsConfigFile: string,
    transpileOnly = false,
    filter?: (name: string) => boolean
): Promise<Record<string, string>> => {
    await compile(files, { websmith: { tsConfigFile, config: { transpileOnly } } });
    return readOutput(path.join(projectDir, "websmith"), filter);
};

describe("compile w/ websmith and tsc defaults", () => {
    it.each(["node16", "nodenext", "preserve", "commonjs"])(
        "emits tsc's JavaScript and declarations w/ module %s and no target",
        async module => {
            const files = writeSources(SOURCES);
            const tsConfigFile = writeTsConfig(files, { module });
            const expected = await compileTsc();

            const actual = await compileWebsmith(files, tsConfigFile);

            expect(Object.keys(expected)).toEqual(expect.arrayContaining(["index.js", "index.d.ts", "dynamic.d.mts"]));
            expect(actual).toEqual(expected);
        },
        60000
    );

    it.each(["node16", "nodenext", "preserve", "commonjs"])(
        "emits tsc's JavaScript w/ transpileOnly, module %s and no target",
        async module => {
            const files = writeSources(SOURCES);
            const tsConfigFile = writeTsConfig(files, { module });
            const expected = await compileTsc(isJavaScript);

            const actual = await compileWebsmith(files, tsConfigFile, true, isJavaScript);

            expect(Object.keys(expected)).toEqual(expect.arrayContaining(["index.js"]));
            expect(actual).toEqual(expected);
        },
        60000
    );

    it("emits interop types for a dynamic import of a CommonJS module w/ module nodenext", async () => {
        const files = writeSources(SOURCES);
        const tsConfigFile = writeTsConfig(files, { module: "nodenext" });

        const actual = await compileWebsmith(files, tsConfigFile);

        expect(actual["dynamic.d.mts"]).toContain(`Promise<{\n    default: typeof import("./def.js");\n    x: 1;\n}>`);
    }, 60000);

    it("emits class fields and default import interop w/ module nodenext", async () => {
        const files = writeSources(SOURCES);
        const tsConfigFile = writeTsConfig(files, { module: "nodenext" });

        const actual = await compileWebsmith(files, tsConfigFile);

        expect(actual["index.js"]).toContain("__importDefault(require(");
        expect(actual["index.js"]).toMatch(/class Point {\s+x = 1;\s+y;/);
    }, 60000);

    it("emits jsx file for tsx source w/o jsx option", async () => {
        const files = writeSources({ "view.tsx": `export const View = () => <div />;\n` });
        const tsConfigFile = writeTsConfig(files, { module: "commonjs" });

        const actual = await compileWebsmith(files, tsConfigFile);

        expect(Object.keys(actual)).toEqual(expect.arrayContaining(["view.jsx"]));
        expect(Object.keys(actual)).not.toContain("view.js");
    }, 60000);
});
