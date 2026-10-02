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
const COMMONJS = { kind: "commonjs" } as const;

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

    it("yields 91010 with hint before query w/ extensionless import with query in node ESM file", () => {
        const actual = checkMissingExtension(scan(`import "./b?v=1";`), ESM, createContext({ "/dist/b.js": "" })).map(cur => cur.message);

        expect(actual).toEqual([`relative import "./b?v=1" has no file extension, which ES modules require; add the extension: "./b.js?v=1"`]);
    });

    it("yields 91010 w/ extensionless literal dynamic import in node CommonJS file", () => {
        const actual = checkMissingExtension(scan(`import("./b");`), COMMONJS, createContext()).map(cur => cur.code);

        expect(actual).toEqual([91010]);
    });

    it("yields nothing w/ extensionless static import in node CommonJS file", () => {
        const actual = checkMissingExtension(scan(`import "./b";`), COMMONJS, createContext());

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ extensionless literal dynamic import in bundler dynamic file", () => {
        const actual = checkMissingExtension(scan(`import("./b");`), DYNAMIC, createContext({}, { runtime: "bundler" }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ extensionless literal dynamic import in CommonJS file under bundler runtime", () => {
        const actual = checkMissingExtension(scan(`import("./b");`), COMMONJS, createContext({}, { runtime: "bundler" }));

        expect(actual).toEqual([]);
    });
});

describe("checkMissingExtension w/ ambiguous names", () => {
    it("yields 91010 with hint w/ dotted extensionless name of written file in ESM file", () => {
        const actual = checkMissingExtension(
            scan(`import "./user.service";`),
            ESM,
            createContext({}, { writtenFiles: new Set(["/dist/user.service.js"]) })
        ).map(cur => cur.message);

        expect(actual).toEqual([
            `relative import "./user.service" has no file extension, which ES modules require; add the extension: "./user.service.js"`,
        ]);
    });

    it("yields only 91012 w/ dotted name of missing file in ESM file", () => {
        const actual = checkImports(scan(`import "./app.module";`), ESM, createContext()).map(cur => cur.code);

        expect(actual).toEqual([91012]);
    });

    it("yields only 91012 w/ import of missing stylesheet in ESM file", () => {
        const actual = checkImports(scan(`import "./styles.css";`), ESM, createContext()).map(cur => cur.code);

        expect(actual).toEqual([91012]);
    });

    it("yields nothing w/ import of existing stylesheet in ESM file", () => {
        const actual = checkImports(scan(`import "./styles.css";`), ESM, createContext({ "/dist/styles.css": "" }));

        expect(actual).toEqual([]);
    });

    it("yields 91010 with hint w/ file and directory of the same name in ESM file", () => {
        const actual = checkMissingExtension(
            scan(`import "./b";`),
            ESM,
            createContext({}, { writtenFiles: new Set(["/dist/b.js", "/dist/b/other.js"]) })
        ).map(cur => cur.message);

        expect(actual).toEqual([`relative import "./b" has no file extension, which ES modules require; add the extension: "./b.js"`]);
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

    it("yields 91011 with hint before query w/ directory import with query in node ESM file", () => {
        const actual = checkDirectoryImport(scan(`import "./utils?v=1";`), ESM, createContext({ "/dist/utils/index.js": "" })).map(
            cur => cur.message
        );

        expect(actual).toEqual([
            `relative import "./utils?v=1" names a directory, which ES modules cannot import; import the file: "./utils/index.js?v=1"`,
        ]);
    });

    it("yields 91011 w/ literal dynamic import of directory in node CommonJS file", () => {
        const actual = checkDirectoryImport(scan(`import("./utils");`), COMMONJS, createContext({ "/dist/utils/index.js": "" })).map(cur => cur.code);

        expect(actual).toEqual([91011]);
    });
});

describe("checkDirectoryImport w/ ambiguous names", () => {
    it("yields nothing w/ file and directory of the same name in ESM file", () => {
        const actual = checkDirectoryImport(
            scan(`import "./b";`),
            ESM,
            createContext({}, { writtenFiles: new Set(["/dist/b.js", "/dist/b/other.js"]) })
        );

        expect(actual).toEqual([]);
    });

    it("yields 91011 w/ trailing slash import of directory next to file of the same name in ESM file", () => {
        const actual = checkImports(
            scan(`import "./utils/";`),
            ESM,
            createContext({}, { writtenFiles: new Set(["/dist/utils.js", "/dist/utils/index.js"]) })
        ).map(cur => cur.code);

        expect(actual).toEqual([91011]);
    });

    it("yields message without index file hint w/ directory without index.js", () => {
        const actual = checkDirectoryImport(scan(`import "./utils";`), ESM, createContext({ "/dist/utils/other.js": "" })).map(cur => cur.message);

        expect(actual).toEqual([`relative import "./utils" names a directory, which ES modules cannot import; import a file inside the directory`]);
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

    it("yields nothing w/ query on import of existing file in node ESM file", () => {
        const actual = checkUnresolvedImport(scan(`import "./b.js?v=1";`), ESM, createContext({ "/dist/b.js": "" }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ fragment on import of existing file in node ESM file", () => {
        const actual = checkUnresolvedImport(scan(`import "./b.js#h";`), ESM, createContext({ "/dist/b.js": "" }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ percent-encoded space in import of existing file in node ESM file", () => {
        const actual = checkUnresolvedImport(scan(`import "./my%20file.js";`), ESM, createContext({ "/dist/my file.js": "" }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ percent-encoded hash naming file with hash in node ESM file", () => {
        const actual = checkUnresolvedImport(scan(`import "./a%23b.js";`), ESM, createContext({ "/dist/a#b.js": "" }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ query on import of existing file in bundler ESM file", () => {
        const actual = checkUnresolvedImport(scan(`import "./b.js?v=1";`), ESM, createContext({ "/dist/b.js": "" }, { runtime: "bundler" }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ extensionless import with query in bundler auto file", () => {
        const actual = checkUnresolvedImport(scan(`import "./b?v=1";`), AUTO, createContext({ "/dist/b.js": "" }, { runtime: "bundler" }));

        expect(actual).toEqual([]);
    });

    it("yields 91012 w/ percent-encoded slash in node ESM file", () => {
        const actual = checkUnresolvedImport(scan(`import "./a%2Fb.js";`), ESM, createContext({ "/dist/a/b.js": "" })).map(cur => cur.code);

        expect(actual).toEqual([91012]);
    });

    it("yields 91012 w/ percent-encoded backslash in node ESM file", () => {
        const actual = checkUnresolvedImport(scan(`import "./a%5Cb.js";`), ESM, createContext({ "/dist/a\\b.js": "" })).map(cur => cur.code);

        expect(actual).toEqual([91012]);
    });

    it("yields 91012 w/ percent-encoded space in import of existing file in bundler ESM file", () => {
        const actual = checkUnresolvedImport(
            scan(`import "./my%20file.js";`),
            ESM,
            createContext({ "/dist/my file.js": "" }, { runtime: "bundler" })
        ).map(cur => cur.code);

        expect(actual).toEqual([91012]);
    });

    it("yields nothing w/ import of file named with hash in bundler ESM file", () => {
        const actual = checkUnresolvedImport(scan(`import "./a#b.js";`), ESM, createContext({ "/dist/a#b.js": "" }, { runtime: "bundler" }));

        expect(actual).toEqual([]);
    });

    it("yields 91012 w/ literal dynamic import of missing file in node CommonJS file", () => {
        const actual = checkUnresolvedImport(scan(`import("./gone.js");`), COMMONJS, createContext()).map(cur => cur.code);

        expect(actual).toEqual([91012]);
    });

    it("yields 91012 w/ import of directory without index file in bundler auto file", () => {
        const actual = checkUnresolvedImport(scan(`import "./dir";`), AUTO, createContext({ "/dist/dir/other.js": "" }, { runtime: "bundler" })).map(
            cur => cur.code
        );

        expect(actual).toEqual([91012]);
    });

    it("yields 91012 w/ import of empty directory in bundler auto file", () => {
        const system = createSystem({}, { virtual: true });
        system.createDirectory("/dist/empty");

        const actual = checkUnresolvedImport(scan(`import "./empty";`), AUTO, { runtime: "bundler", system }).map(cur => cur.code);

        expect(actual).toEqual([91012]);
    });

    it("yields 91012 w/ import of directory with package.json without entry field in bundler auto file", () => {
        const actual = checkUnresolvedImport(
            scan(`import "./dir";`),
            AUTO,
            createContext({ "/dist/dir/package.json": `{"name":"d"}` }, { runtime: "bundler" })
        ).map(cur => cur.code);

        expect(actual).toEqual([91012]);
    });

    it("yields 91012 w/ import of directory with package.json with empty main in bundler auto file", () => {
        const actual = checkUnresolvedImport(
            scan(`import "./dir";`),
            AUTO,
            createContext({ "/dist/dir/package.json": `{"main":""}` }, { runtime: "bundler" })
        ).map(cur => cur.code);

        expect(actual).toEqual([91012]);
    });

    it("yields message naming heuristic w/ import of directory without index file in bundler auto file", () => {
        const actual = checkUnresolvedImport(scan(`import "./dir";`), AUTO, createContext({ "/dist/dir/other.js": "" }, { runtime: "bundler" })).map(
            cur => cur.message
        );

        expect(actual).toEqual([
            `relative import "./dir" names a directory with no index file and no package.json entry; ` +
                'if your webpack config sets `resolve.mainFiles` or `resolve.mainFields`, use `esm.ignore` or `check: "warn"`',
        ]);
    });

    it("yields nothing w/ import of directory with package.json with only module field in bundler auto file", () => {
        const actual = checkUnresolvedImport(
            scan(`import "./dir";`),
            AUTO,
            createContext({ "/dist/dir/package.json": `{"module":"m.js"}`, "/dist/dir/m.js": "" }, { runtime: "bundler" })
        );

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ import of directory with package.json with extensionless main in bundler auto file", () => {
        const actual = checkUnresolvedImport(
            scan(`import "./dir";`),
            AUTO,
            createContext({ "/dist/dir/package.json": `{"main":"lib"}`, "/dist/dir/lib.js": "" }, { runtime: "bundler" })
        );

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ import of directory with package.json with main naming directory in bundler auto file", () => {
        const actual = checkUnresolvedImport(
            scan(`import "./dir";`),
            AUTO,
            createContext({ "/dist/dir/package.json": `{"main":"./lib"}`, "/dist/dir/lib/index.js": "" }, { runtime: "bundler" })
        );

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ import of directory with package.json with main naming missing file in bundler auto file", () => {
        const actual = checkUnresolvedImport(
            scan(`import "./dir";`),
            AUTO,
            createContext({ "/dist/dir/package.json": `{"main":"gone.js"}` }, { runtime: "bundler" })
        );

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ import of directory with package.json with only browser field in bundler auto file", () => {
        const actual = checkUnresolvedImport(
            scan(`import "./dir";`),
            AUTO,
            createContext({ "/dist/dir/package.json": `{"browser":"b.js"}`, "/dist/dir/b.js": "" }, { runtime: "bundler" })
        );

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ import of directory with only index.mjs in bundler auto file", () => {
        const actual = checkUnresolvedImport(scan(`import "./dir";`), AUTO, createContext({ "/dist/dir/index.mjs": "" }, { runtime: "bundler" }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ import of directory with index.js written this run in bundler auto file", () => {
        const actual = checkUnresolvedImport(
            scan(`import "./dir";`),
            AUTO,
            createContext({}, { runtime: "bundler", writtenFiles: new Set(["/dist/dir/index.js"]) })
        );

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

    it("yields 91013 asking to replace assert w/ JSON import with assert clause in node ESM file", () => {
        const actual = checkJsonImportAttribute(scan(`import data from "./d.json" assert { type: "json" };`), ESM, createContext()).map(cur => [
            cur.code,
            cur.message,
        ]);

        expect(actual).toEqual([[91013, `JSON import "./d.json" uses "assert", which Node does not support; replace "assert" with "with"`]]);
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

    it("yields 91013 w/ bare JSON specifier in node ESM file", () => {
        const actual = checkJsonImportAttribute(scan(`import data from "pkg/d.json";`), ESM, createContext()).map(cur => [cur.code, cur.message]);

        expect(actual).toEqual([[91013, `JSON import "pkg/d.json" has no import attribute, which Node requires; add: with { type: "json" }`]]);
    });

    it("yields 91013 w/ bare specifier mapped to JSON file by package exports in node ESM file", () => {
        const actual = checkJsonImportAttribute(
            scan(`import d from "jpkg/data";`),
            ESM,
            createContext({
                "/dist/node_modules/jpkg/package.json": `{"name":"jpkg","exports":{"./data":"./d.json"}}`,
                "/dist/node_modules/jpkg/d.json": "{}",
            })
        ).map(cur => cur.code);

        expect(actual).toEqual([91013]);
    });

    it("yields 91013 w/ literal dynamic bare JSON import in node ESM file", () => {
        const actual = checkJsonImportAttribute(scan(`await import("jpkg/d.json");`), ESM, createContext()).map(cur => cur.code);

        expect(actual).toEqual([91013]);
    });

    it("yields 91013 w/ literal dynamic JSON import in node CommonJS file", () => {
        const actual = checkJsonImportAttribute(scan(`import("./d.json");`), COMMONJS, createContext()).map(cur => cur.code);

        expect(actual).toEqual([91013]);
    });

    it("yields nothing w/ bare JSON specifier with type json attribute in node ESM file", () => {
        const actual = checkJsonImportAttribute(scan(`import data from "pkg/d.json" with { type: "json" };`), ESM, createContext());

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ bare JSON specifier in bundler ESM file", () => {
        const actual = checkJsonImportAttribute(scan(`import data from "pkg/d.json";`), ESM, createContext({}, { runtime: "bundler" }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ bare specifier resolving to JS entry in node ESM file", () => {
        const actual = checkJsonImportAttribute(
            scan(`import x from "jpkg";`),
            ESM,
            createContext({
                "/dist/node_modules/jpkg/package.json": `{"name":"jpkg","main":"index.js"}`,
                "/dist/node_modules/jpkg/index.js": "",
            })
        );

        expect(actual).toEqual([]);
    });

    it("yields 91013 w/ JSON import with query in node ESM file", () => {
        const actual = checkJsonImportAttribute(scan(`import data from "./d.json?v=1";`), ESM, createContext()).map(cur => cur.code);

        expect(actual).toEqual([91013]);
    });

    it("yields nothing w/ JSON import with query and type json attribute in node ESM file", () => {
        const actual = checkJsonImportAttribute(scan(`import data from "./d.json?v=1" with { type: "json" };`), ESM, createContext());

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ JSON import with query in bundler ESM file", () => {
        const actual = checkJsonImportAttribute(scan(`import data from "./d.json?v=1";`), ESM, createContext({}, { runtime: "bundler" }));

        expect(actual).toEqual([]);
    });
});

describe("checkImports", () => {
    it("yields only 91010 w/ dotted extensionless name of written file in ESM file", () => {
        const actual = checkImports(
            scan(`import "./user.service";`),
            ESM,
            createContext({}, { writtenFiles: new Set(["/dist/user.service.js"]) })
        ).map(cur => cur.code);

        expect(actual).toEqual([91010]);
    });

    it("probes no directory w/ imports of existing files", () => {
        const system = createSystem({}, { virtual: true });
        const target = jest.spyOn(system, "directoryExists");
        const names = Array.from({ length: 50 }, (_, i) => `/dist/m${i}.js`);

        checkImports(scan(names.map(cur => `import ".${cur.slice(5)}";`).join("\n")), ESM, { runtime: "node", system, writtenFiles: new Set(names) });

        expect(target).not.toHaveBeenCalled();
    });

    it("probes each directory once w/ repeated imports of a directory", () => {
        const system = createSystem({ "/dist/utils/index.js": "" }, { virtual: true });
        const target = jest.spyOn(system, "directoryExists");

        checkImports(scan(`import "./utils";\nexport * from "./utils";`), ESM, { runtime: "node", system });

        expect(target).toHaveBeenCalledTimes(1);
    });

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

    it("yields 91010 w/ import of file named with hash in node ESM file", () => {
        const actual = checkImports(scan(`import "./a#b.js";`), ESM, createContext({ "/dist/a#b.js": "" })).map(cur => cur.code);

        expect(actual).toEqual([91010]);
    });

    it("yields findings per runtime w/ same scanned file checked under node and bundler", () => {
        const scanned = scan(`import "./my%20file.js";`);
        const files = { "/dist/my file.js": "" };

        const actual = [createContext(files), createContext(files, { runtime: "bundler" })].map(cur =>
            checkImports(scanned, ESM, cur).map(it => it.code)
        );

        expect(actual).toEqual([[], [91012]]);
    });
});
