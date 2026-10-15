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

const request = (url: string, method = "GET", host?: string): MiddlewareRequest => ({ url, method, headers: { host } });

const ANY_HOST = (): boolean => true;

describe("createVirtualFileMiddleware", () => {
    it("should answer GET with content and content type w/ virtual file", () => {
        const testObj = createVirtualFileMiddleware(findVirtualFile({ "virt/main.json": '{"v":1}' }), "/", ANY_HOST);
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
        const testObj = createVirtualFileMiddleware(findVirtualFile({ "virt/main.json": '{"v":1}' }), "/", ANY_HOST);
        const target = createResponse();

        testObj(request("/virt/main.json", "HEAD"), target, jest.fn());
        const actual = target.end.mock.calls;

        expect(actual).toEqual([[]]);
    });

    it("should pass base to lookup w/ base", () => {
        const target = jest.fn(findVirtualFile({ "a.txt": "A" }));
        const testObj = createVirtualFileMiddleware(target, "/app/", ANY_HOST);

        testObj(request("/app/a.txt"), createResponse(), jest.fn());

        expect(target).toHaveBeenCalledWith("/app/a.txt", "/app/");
    });

    it("should call next w/ unknown url", () => {
        const testObj = createVirtualFileMiddleware(findVirtualFile({}), "/", ANY_HOST);
        const target = jest.fn();

        testObj(request("/src/main.ts"), createResponse(), target);

        expect(target).toHaveBeenCalledTimes(1);
    });

    it("should call next w/ POST of virtual file", () => {
        const testObj = createVirtualFileMiddleware(findVirtualFile({ "a.txt": "A" }), "/", ANY_HOST);
        const target = jest.fn();

        testObj(request("/a.txt", "POST"), createResponse(), target);

        expect(target).toHaveBeenCalledTimes(1);
    });

    it("should call next w/o url", () => {
        const testObj = createVirtualFileMiddleware(findVirtualFile({}), "/", ANY_HOST);
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
        const testObj = createVirtualFileMiddleware(findVirtualFile({ [fileName]: "whatever" }), "/", ANY_HOST);
        const target = createResponse();

        testObj(request(`/${fileName}`), target, jest.fn());
        const actual: unknown = target.setHeader.mock.calls[0];

        expect(actual).toEqual(["Content-Type", expected]);
    });

    it("should answer 403 w/ virtual file and host not allowed", () => {
        const testObj = createVirtualFileMiddleware(findVirtualFile({ "virt/main.json": '{"v":1}' }), "/", () => false);
        const target = createResponse();

        testObj(request("/virt/main.json", "GET", "evil.example:5173"), target, jest.fn());
        const actual = [target.statusCode, target.setHeader.mock.calls, target.end.mock.calls];

        expect(actual).toEqual([
            403,
            [["Content-Type", "text/plain"]],
            [['Blocked request. This host ("evil.example") is not allowed.\nTo allow this host, add "evil.example" to `server.allowedHosts` in vite.config.js.']],
        ]);
    });

    it("should pass host to host check w/ virtual file", () => {
        const target = jest.fn(() => true);
        const testObj = createVirtualFileMiddleware(findVirtualFile({ "a.txt": "A" }), "/", target);

        testObj(request("/a.txt", "GET", "app.example"), createResponse(), jest.fn());

        expect(target).toHaveBeenCalledWith("app.example");
    });

    it("should call next and not check host w/ unknown url", () => {
        const target = jest.fn(() => false);
        const testObj = createVirtualFileMiddleware(findVirtualFile({}), "/", target);
        const next = jest.fn();

        testObj(request("/src/main.ts", "GET", "evil.example"), createResponse(), next);

        expect([next.mock.calls.length, target.mock.calls.length]).toEqual([1, 0]);
    });
});
