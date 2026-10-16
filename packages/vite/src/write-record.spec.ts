/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createSystem } from "@quatico/websmith-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { createDeduplicatingSystem, WriteRecord, type ReadBytes } from "./write-record";

const BYTE_ORDER_MARK = "\uFEFF";

// A virtual system, and a reader of its bytes, since a virtual system keeps no byte order mark
const createTarget = (files: Record<string, string> = {}) => {
    const system = createSystem(files, { virtual: true });
    const read: ReadBytes = cur => (system.fileExists(cur) ? Buffer.from(system.readFile(cur) ?? "", "utf-8") : undefined);
    return { system, read, writeFile: jest.spyOn(system, "writeFile") };
};

const tempDirs: string[] = [];

// A file on disk with `text`, in a new temp dir
const createDiskFile = (text: string): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "websmith-vite-write-record-"));
    tempDirs.push(dir);
    const filePath = path.join(dir, "a.js");
    fs.writeFileSync(filePath, text, "utf-8");
    return filePath;
};

afterEach(() => {
    tempDirs.splice(0).forEach(cur => fs.rmSync(cur, { recursive: true, force: true }));
});

describe("createDeduplicatingSystem", () => {
    it("should skip identical second write", () => {
        const { system: target, read, writeFile } = createTarget();
        const testObj = createDeduplicatingSystem(target, new WriteRecord(), read);
        testObj.writeFile("/out/a.js", "A");

        testObj.writeFile("/out/a.js", "A");

        expect(writeFile).toHaveBeenCalledTimes(1);
    });

    it("should skip first write w/ same text on disk", () => {
        const { system: target, read, writeFile } = createTarget({ "/out/a.js": "A" });
        const testObj = createDeduplicatingSystem(target, new WriteRecord(), read);

        testObj.writeFile("/out/a.js", "A");

        expect(writeFile).not.toHaveBeenCalled();
    });

    it("should write changed text", () => {
        const { system: target, read } = createTarget();
        const testObj = createDeduplicatingSystem(target, new WriteRecord(), read);
        testObj.writeFile("/out/a.js", "A");

        testObj.writeFile("/out/a.js", "B");

        expect(target.readFile("/out/a.js")).toBe("B");
    });

    it("should write again w/ file changed by another writer", () => {
        const { system: target, read } = createTarget();
        const testObj = createDeduplicatingSystem(target, new WriteRecord(), read);
        testObj.writeFile("/out/a.js", "A");
        target.writeFile("/out/a.js", "OTHER");

        testObj.writeFile("/out/a.js", "A");

        expect(target.readFile("/out/a.js")).toBe("A");
    });

    it("should skip identical write after write over file changed by another writer", () => {
        const { system: target, read, writeFile } = createTarget();
        const testObj = createDeduplicatingSystem(target, new WriteRecord(), read);
        testObj.writeFile("/out/a.js", "A");
        target.writeFile("/out/a.js", "OTHER");
        testObj.writeFile("/out/a.js", "A");

        testObj.writeFile("/out/a.js", "A");

        expect(writeFile).toHaveBeenCalledTimes(3);
    });

    it("should write again w/ deleted file", () => {
        const { system: target, read } = createTarget();
        const testObj = createDeduplicatingSystem(target, new WriteRecord(), read);
        testObj.writeFile("/out/a.js", "A");
        target.deleteFile!("/out/a.js");

        testObj.writeFile("/out/a.js", "A");

        expect(target.readFile("/out/a.js")).toBe("A");
    });

    it("should write w/ byte order mark and same text on disk", () => {
        const { system: target, read, writeFile } = createTarget({ "/out/a.js": "A" });
        const testObj = createDeduplicatingSystem(target, new WriteRecord(), read);

        testObj.writeFile("/out/a.js", "A", true);

        expect(writeFile).toHaveBeenCalledWith("/out/a.js", "A", true);
    });

    it("should write w/ byte order mark on disk and same text without", () => {
        const filePath = createDiskFile(BYTE_ORDER_MARK + "A");
        const testObj = createDeduplicatingSystem(ts.sys, new WriteRecord());

        testObj.writeFile(filePath, "A");

        expect(fs.readFileSync(filePath, "utf-8")).toBe("A");
    });

    it("should skip write w/ byte order mark and same bytes on disk", () => {
        const filePath = createDiskFile(BYTE_ORDER_MARK + "A");
        const target = { ...ts.sys, writeFile: jest.fn() };
        const testObj = createDeduplicatingSystem(target, new WriteRecord());

        testObj.writeFile(filePath, "A", true);

        expect(target.writeFile).not.toHaveBeenCalled();
    });

    it("should skip first write w/ same text on real disk", () => {
        const filePath = createDiskFile("A");
        const target = { ...ts.sys, writeFile: jest.fn() };
        const testObj = createDeduplicatingSystem(target, new WriteRecord());

        testObj.writeFile(filePath, "A");

        expect(target.writeFile).not.toHaveBeenCalled();
    });

    it("should record written text", () => {
        const { system: target, read } = createTarget();
        const record = new WriteRecord();
        const testObj = createDeduplicatingSystem(target, record, read);

        testObj.writeFile("/out/a.js", "A");
        const actual = record.isOwnWrite("/out/a.js", "A");

        expect(actual).toBe(true);
    });

    it("should not record skipped write", () => {
        const { system: target, read } = createTarget({ "/out/a.js": "A" });
        const record = new WriteRecord();
        const testObj = createDeduplicatingSystem(target, record, read);

        testObj.writeFile("/out/a.js", "A");
        const actual = record.has("/out/a.js");

        expect(actual).toBe(false);
    });

    it("should skip write of other system w/ shared record and same text on disk", () => {
        const { system: target, read, writeFile } = createTarget();
        const record = new WriteRecord();
        createDeduplicatingSystem(target, record, read).writeFile("/out/a.js", "A");
        const testObj = createDeduplicatingSystem(target, record, read);

        testObj.writeFile("/out/a.js", "A");

        expect(writeFile).toHaveBeenCalledTimes(1);
    });

    it("should leave target system unchanged", () => {
        const { system: target, read, writeFile } = createTarget();
        createDeduplicatingSystem(target, new WriteRecord(), read).writeFile("/out/a.js", "A");

        target.writeFile("/out/a.js", "A");

        expect(writeFile).toHaveBeenCalledTimes(2);
    });

    it("should keep members of system in spread copy", () => {
        const { system: target, read } = createTarget();
        target.writeFile("/out/a.js", "A");

        const actual = { ...createDeduplicatingSystem(target, new WriteRecord(), read) }.readFile("/out/a.js");

        expect(actual).toBe("A");
    });
});

describe("WriteRecord", () => {
    it("should have recorded path", () => {
        const testObj = new WriteRecord();
        testObj.record("/out/a.js", "A");

        const actual = testObj.has("/out/a.js");

        expect(actual).toBe(true);
    });

    it("should not have unrecorded path", () => {
        const testObj = new WriteRecord();

        const actual = testObj.has("/out/a.js");

        expect(actual).toBe(false);
    });

    it("should be own write w/ recorded text", () => {
        const testObj = new WriteRecord();
        testObj.record("/out/a.js", "A");

        const actual = testObj.isOwnWrite("/out/a.js", "A");

        expect(actual).toBe(true);
    });

    it("should be own write twice w/ recorded text", () => {
        const testObj = new WriteRecord();
        testObj.record("/out/a.js", "A");
        testObj.isOwnWrite("/out/a.js", "A");

        const actual = testObj.isOwnWrite("/out/a.js", "A");

        expect(actual).toBe(true);
    });

    it("should not be own write w/ other text", () => {
        const testObj = new WriteRecord();
        testObj.record("/out/a.js", "A");

        const actual = testObj.isOwnWrite("/out/a.js", "B");

        expect(actual).toBe(false);
    });

    it("should not be own write w/ recorded text after other text", () => {
        const testObj = new WriteRecord();
        testObj.record("/out/a.js", "A");
        testObj.isOwnWrite("/out/a.js", "B");

        const actual = testObj.isOwnWrite("/out/a.js", "A");

        expect(actual).toBe(false);
    });

    it("should forget path w/ other text", () => {
        const testObj = new WriteRecord();
        testObj.record("/out/a.js", "A");
        testObj.isOwnWrite("/out/a.js", "B");

        const actual = testObj.has("/out/a.js");

        expect(actual).toBe(false);
    });

    it("should forget path w/ forget", () => {
        const testObj = new WriteRecord();
        testObj.record("/out/a.js", "A");
        testObj.forget("/out/a.js");

        const actual = testObj.isOwnWrite("/out/a.js", "A");

        expect(actual).toBe(false);
    });

    it("should be own write w/ byte order mark recorded and read", () => {
        const testObj = new WriteRecord();
        testObj.record("/out/a.js", "A", true);

        const actual = testObj.isOwnWrite("/out/a.js", "\uFEFFA");

        expect(actual).toBe(true);
    });

    it("should be own write w/ windows separators in recorded path", () => {
        const testObj = new WriteRecord();
        testObj.record("C:\\out\\a.js", "A");

        const actual = testObj.isOwnWrite("C:/out/a.js", "A");

        expect(actual).toBe(true);
    });
});
