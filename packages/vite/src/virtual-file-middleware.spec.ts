/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type VirtualFile } from "./hooks";
import { createVirtualFileMiddleware, type MiddlewareRequest, type MiddlewareResponse } from "./virtual-file-middleware";

const createResponse = (): MiddlewareResponse & { setHeader: jest.Mock; end: jest.Mock } => ({ statusCode: 0, setHeader: jest.fn(), end: jest.fn() });

const findVirtualFile =
    (files: Record<string, string>) =>
    (url: string, base: string): VirtualFile | undefined => {
        const fileName = url.slice(base.length);
        return fileName in files ? { fileName, content: files[fileName] } : undefined;
    };

const request = (url: string, method = "GET"): MiddlewareRequest => ({ url, method });

describe("createVirtualFileMiddleware", () => {
    it("should answer GET with content and content type w/ virtual file", () => {
        const testObj = createVirtualFileMiddleware(findVirtualFile({ "virt/main.json": '{"v":1}' }), "/");
        const target = createResponse();

        testObj(request("/virt/main.json"), target, jest.fn());
        const actual = [target.statusCode, target.setHeader.mock.calls, target.end.mock.calls];

        expect(actual).toEqual([
            200,
            [
                ["Content-Type", "application/json"],
                ["Content-Length", 7],
            ],
            [['{"v":1}']],
        ]);
    });

    it("should answer HEAD without body w/ virtual file", () => {
        const testObj = createVirtualFileMiddleware(findVirtualFile({ "virt/main.json": '{"v":1}' }), "/");
        const target = createResponse();

        testObj(request("/virt/main.json", "HEAD"), target, jest.fn());
        const actual = target.end.mock.calls;

        expect(actual).toEqual([[]]);
    });

    it("should pass base to lookup w/ base", () => {
        const target = jest.fn(findVirtualFile({ "a.txt": "A" }));
        const testObj = createVirtualFileMiddleware(target, "/app/");

        testObj(request("/app/a.txt"), createResponse(), jest.fn());

        expect(target).toHaveBeenCalledWith("/app/a.txt", "/app/");
    });

    it("should call next w/ unknown url", () => {
        const testObj = createVirtualFileMiddleware(findVirtualFile({}), "/");
        const target = jest.fn();

        testObj(request("/src/main.ts"), createResponse(), target);

        expect(target).toHaveBeenCalledTimes(1);
    });

    it("should call next w/ POST of virtual file", () => {
        const testObj = createVirtualFileMiddleware(findVirtualFile({ "a.txt": "A" }), "/");
        const target = jest.fn();

        testObj(request("/a.txt", "POST"), createResponse(), target);

        expect(target).toHaveBeenCalledTimes(1);
    });

    it("should call next w/o url", () => {
        const testObj = createVirtualFileMiddleware(findVirtualFile({}), "/");
        const target = jest.fn();

        testObj({ method: "GET" }, createResponse(), target);

        expect(target).toHaveBeenCalledTimes(1);
    });

    it.each([
        ["a.json", "application/json"],
        ["a.js", "text/javascript"],
        ["a.mjs", "text/javascript"],
        ["a.css", "text/css"],
        ["a.html", "text/html"],
        ["a.txt", "text/plain"],
        ["a.svg", "image/svg+xml"],
        ["a.bin", "application/octet-stream"],
        ["A.JSON", "application/json"],
    ])("should set content type w/ %s", (fileName, expected) => {
        const testObj = createVirtualFileMiddleware(findVirtualFile({ [fileName]: "whatever" }), "/");
        const target = createResponse();

        testObj(request(`/${fileName}`), target, jest.fn());
        const actual: unknown = target.setHeader.mock.calls[0];

        expect(actual).toEqual(["Content-Type", expected]);
    });
});
