import { compileSystem } from "../testing";
import { ignoreConfigFiles, recursiveFindByFilter } from "./system";

describe("recursiveFindByFilter", () => {
    it("should find files", () => {
        const { fileSystem } = compileSystem({
            files: {
                "test.ts": "console.log('test');",
            },
        });

        const actual = recursiveFindByFilter(".", (name: string) => name.endsWith(".ts"), fileSystem);

        expect(actual).toEqual(["/test.ts"]);
    });

    it("should find files in subdirectories", () => {
        const { fileSystem } = compileSystem({
            files: {
                "subdir/test.ts": "console.log('test');",
            },
        });

        const actual = recursiveFindByFilter(".", (name: string) => name.endsWith(".ts"), fileSystem);

        expect(actual).toEqual(["/subdir/test.ts"]);
    });

    it("should find files in subdirectories with absolute paths", () => {
        const { fileSystem } = compileSystem({
            files: {
                "/target/tsconfig.json": "{}",
                "/target/addons/expected-addon/addon.ts": "console.log('test')",
            },
        });

        const actual = recursiveFindByFilter(".", (name: string) => name.endsWith(".ts"), fileSystem);

        expect(actual).toEqual(["/target/addons/expected-addon/addon.ts"]);
    });
});

describe("ignoreConfigFiles", () => {
    it("should ignore config files", () => {
        expect(ignoreConfigFiles("tsconfig.json")).toBe(false);
        expect(ignoreConfigFiles("tsconfig.prod.json")).toBe(false);
        expect(ignoreConfigFiles("websmith.config.json")).toBe(false);
        expect(ignoreConfigFiles("websmith.config.prod.json")).toBe(false);
        expect(ignoreConfigFiles("test.ts")).toBe(true);
    });
});
