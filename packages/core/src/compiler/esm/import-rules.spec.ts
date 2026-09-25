/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createSystem } from "../../environment";
import {
    checkDirectoryImport,
    checkImports,
    checkJsonImportAttribute,
    checkMissingExtension,
    checkUnresolvedImport,
    type ImportRuleContext,
} from "./import-rules";
import { scanModule } from "./scan-module";

const ESM = { kind: "esm" } as const;
const AUTO = { kind: "auto" } as const;
const DYNAMIC = { kind: "dynamic" } as const;

const createContext = (files: Record<string, string> = {}, overrides: Partial<ImportRuleContext> = {}): ImportRuleContext => ({
    runtime: "node",
    system: createSystem(files, { virtual: true }),
    ...overrides,
});

const scan = (text: string) => scanModule("/dist/target.js", text);

describe("checkMissingExtension", () => {
    it("yields 91010 w/ extensionless static import in ESM file", () => {
        const actual = checkMissingExtension(scan(`import "./b";`), ESM, createContext()).map(cur => cur.code);

        expect(actual).toEqual([91010]);
    });

    it("yields 91010 w/ extensionless named re-export in ESM file", () => {
        const actual = checkMissingExtension(scan(`export { x } from "./b";`), ESM, createContext()).map(cur => cur.code);

        expect(actual).toEqual([91010]);
    });

    it("yields 91010 w/ extensionless star re-export in ESM file", () => {
        const actual = checkMissingExtension(scan(`export * from "../b";`), ESM, createContext()).map(cur => cur.code);

        expect(actual).toEqual([91010]);
    });

    it("yields 91010 w/ extensionless literal dynamic import in ESM file", () => {
        const actual = checkMissingExtension(scan(`await import("./b");`), ESM, createContext()).map(cur => cur.code);

        expect(actual).toEqual([91010]);
    });

    it("yields nothing w/ non-literal dynamic import in ESM file", () => {
        const actual = checkMissingExtension(scan(`const name = "./b";\nawait import(name);`), ESM, createContext());

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ explicit extension in ESM file", () => {
        const actual = checkMissingExtension(scan(`import "./b.js";`), ESM, createContext());

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ bare specifier in ESM file", () => {
        const actual = checkMissingExtension(scan(`import x from "pkg";\nimport y from "pkg/sub";`), ESM, createContext());

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ directory import in ESM file", () => {
        const actual = checkMissingExtension(scan(`import "./b";`), ESM, createContext({ "/dist/b/index.js": "" }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ extensionless import in bundler auto file", () => {
        const actual = checkMissingExtension(scan(`import "./b";`), AUTO, createContext({}, { runtime: "bundler" }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ extensionless import in bundler dynamic file", () => {
        const actual = checkMissingExtension(scan(`import "./b";`), DYNAMIC, createContext({}, { runtime: "bundler" }));

        expect(actual).toEqual([]);
    });

    it("yields 91010 w/ extensionless import in bundler ESM file", () => {
        const actual = checkMissingExtension(scan(`import "./b";`), ESM, createContext({}, { runtime: "bundler" })).map(cur => cur.code);

        expect(actual).toEqual([91010]);
    });

    it("yields message with extension hint and specifier location", () => {
        const actual = checkMissingExtension(scan(`import x from "./b";`), ESM, createContext());

        expect(actual).toEqual([
            {
                code: 91010,
                message: `relative import "./b" has no file extension, which ES modules require; add the extension: "./b.js"`,
                start: 14,
                length: 5,
            },
        ]);
    });
});

describe("checkDirectoryImport", () => {
    it("yields 91011 w/ import of directory on disk in ESM file", () => {
        const actual = checkDirectoryImport(scan(`import "./utils";`), ESM, createContext({ "/dist/utils/index.js": "" })).map(cur => cur.code);

        expect(actual).toEqual([91011]);
    });

    it("yields 91011 w/ import of directory written this run in ESM file", () => {
        const actual = checkDirectoryImport(
            scan(`import "./utils";`),
            ESM,
            createContext({}, { writtenFiles: new Set(["/dist/utils/index.js"]) })
        ).map(cur => cur.code);

        expect(actual).toEqual([91011]);
    });

    it("yields nothing w/ import of file in ESM file", () => {
        const actual = checkDirectoryImport(scan(`import "./utils";`), ESM, createContext({ "/dist/utils.js": "" }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ import of directory in bundler auto file", () => {
        const actual = checkDirectoryImport(scan(`import "./utils";`), AUTO, createContext({ "/dist/utils/index.js": "" }, { runtime: "bundler" }));

        expect(actual).toEqual([]);
    });

    it("yields message with index file hint", () => {
        const actual = checkDirectoryImport(scan(`import "./utils/";`), ESM, createContext({ "/dist/utils/index.js": "" })).map(cur => cur.message);

        expect(actual).toEqual([`relative import "./utils/" names a directory, which ES modules cannot import; import the file: "./utils/index.js"`]);
    });
});

describe("checkUnresolvedImport", () => {
    it("yields 91012 w/ import of missing file in ESM file", () => {
        const actual = checkUnresolvedImport(scan(`import "./gone.js";`), ESM, createContext()).map(cur => [cur.code, cur.message]);

        expect(actual).toEqual([[91012, `relative import "./gone.js" resolves to no file written by this build or on disk`]]);
    });

    it("yields nothing w/ import of file on disk not written this run", () => {
        const actual = checkUnresolvedImport(scan(`import "./b.js";`), ESM, createContext({ "/dist/b.js": "" }, { writtenFiles: new Set() }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ import of file written this run but not on disk", () => {
        const actual = checkUnresolvedImport(scan(`import "./b.js";`), ESM, createContext({}, { writtenFiles: new Set(["/dist/b.js"]) }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ extensionless import in ESM file", () => {
        const actual = checkUnresolvedImport(scan(`import "./gone";`), ESM, createContext());

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ directory import in ESM file", () => {
        const actual = checkUnresolvedImport(scan(`import "./utils";`), ESM, createContext({ "/dist/utils/index.js": "" }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ extensionless import of existing file in bundler auto file", () => {
        const actual = checkUnresolvedImport(scan(`import "./b";`), AUTO, createContext({ "/dist/b.js": "" }, { runtime: "bundler" }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ directory import in bundler auto file", () => {
        const actual = checkUnresolvedImport(scan(`import "./utils";`), AUTO, createContext({ "/dist/utils/index.js": "" }, { runtime: "bundler" }));

        expect(actual).toEqual([]);
    });

    it("yields 91012 w/ extensionless import of missing file in bundler auto file", () => {
        const actual = checkUnresolvedImport(scan(`import "./gone";`), AUTO, createContext({}, { runtime: "bundler" })).map(cur => cur.code);

        expect(actual).toEqual([91012]);
    });

    it("yields nothing w/ import of missing file in bundler dynamic file", () => {
        const actual = checkUnresolvedImport(scan(`import "./gone.js";`), DYNAMIC, createContext({}, { runtime: "bundler" }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ bare specifier in ESM file", () => {
        const actual = checkUnresolvedImport(scan(`import x from "pkg";`), ESM, createContext());

        expect(actual).toEqual([]);
    });
});

describe("checkJsonImportAttribute", () => {
    it("yields 91013 w/ JSON import without attribute in node ESM file", () => {
        const actual = checkJsonImportAttribute(scan(`import data from "./d.json";`), ESM, createContext()).map(cur => [cur.code, cur.message]);

        expect(actual).toEqual([[91013, `JSON import "./d.json" has no import attribute, which Node requires; add: with { type: "json" }`]]);
    });

    it("yields nothing w/ JSON import with type json attribute in node ESM file", () => {
        const actual = checkJsonImportAttribute(scan(`import data from "./d.json" with { type: "json" };`), ESM, createContext());

        expect(actual).toEqual([]);
    });

    it("yields 91013 w/ JSON import with assert clause in node ESM file", () => {
        const actual = checkJsonImportAttribute(scan(`import data from "./d.json" assert { type: "json" };`), ESM, createContext()).map(
            cur => cur.code
        );

        expect(actual).toEqual([91013]);
    });

    it("yields 91013 w/ JSON re-export without attribute in node ESM file", () => {
        const actual = checkJsonImportAttribute(scan(`export { default } from "./d.json";`), ESM, createContext()).map(cur => cur.code);

        expect(actual).toEqual([91013]);
    });

    it("yields 91013 w/ literal dynamic JSON import without attribute in node ESM file", () => {
        const actual = checkJsonImportAttribute(scan(`await import("./d.json");`), ESM, createContext()).map(cur => cur.code);

        expect(actual).toEqual([91013]);
    });

    it("yields nothing w/ literal dynamic JSON import with type json attribute in node ESM file", () => {
        const actual = checkJsonImportAttribute(scan(`await import("./d.json", { with: { type: "json" } });`), ESM, createContext());

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ JSON import without attribute in bundler ESM file", () => {
        const actual = checkJsonImportAttribute(scan(`import data from "./d.json";`), ESM, createContext({}, { runtime: "bundler" }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ bare JSON specifier in node ESM file", () => {
        const actual = checkJsonImportAttribute(scan(`import data from "pkg/d.json";`), ESM, createContext());

        expect(actual).toEqual([]);
    });
});

describe("checkImports", () => {
    it("yields every import rule w/ violations in node ESM file", () => {
        const actual = checkImports(
            scan(`import "./b";\nimport "./utils";\nimport "./gone.js";\nimport data from "./d.json";`),
            ESM,
            createContext({ "/dist/utils/index.js": "" }, { writtenFiles: new Set(["/dist/d.json"]) })
        ).map(cur => cur.code);

        expect(actual).toEqual([91010, 91011, 91012, 91013]);
    });

    it("yields nothing w/ bare specifiers in node ESM file", () => {
        const actual = checkImports(scan(`import x from "pkg";\nexport * from "pkg/sub";\nawait import("pkg");`), ESM, createContext());

        expect(actual).toEqual([]);
    });
});
