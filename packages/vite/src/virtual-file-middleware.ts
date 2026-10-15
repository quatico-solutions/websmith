/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import { type WebsmithHooks } from "./hooks";
import { getBlockedHostMessage } from "./host-check";

/** The part of Node's request the middleware reads. */
export type MiddlewareRequest = { url?: string; method?: string; headers?: { host?: string } };

/** The part of Node's response the middleware writes. */
export type MiddlewareResponse = { statusCode: number; setHeader(name: string, value: string | number): unknown; end(chunk?: string): unknown };

/** A Connect middleware, as Vite's dev server takes it. */
export type Middleware = (req: MiddlewareRequest, res: MiddlewareResponse, next: () => void) => void;

const CONTENT_TYPES: Record<string, string> = {
    ".json": "application/json",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".html": "text/html",
    ".txt": "text/plain",
    ".svg": "image/svg+xml",
};

const getContentType = (fileName: string): string => CONTENT_TYPES[path.extname(fileName).toLowerCase()] ?? "application/octet-stream";

/**
 * Creates the dev server middleware that answers `GET` and `HEAD` of a virtual file at `base` + its bundle path with
 * its content, and passes any other request on. A virtual file requested with a `Host` that `isHostAllowed` rejects
 * gets Vite's 403, since Vite 6 runs this middleware before its own host check.
 */
export const createVirtualFileMiddleware =
    (findVirtualFile: WebsmithHooks["findVirtualFile"], base: string, isHostAllowed: (host: string | undefined) => boolean): Middleware =>
    (req, res, next) => {
        const found = req.url !== undefined && (req.method === "GET" || req.method === "HEAD") ? findVirtualFile(req.url, base) : undefined;
        if (!found) {
            next();
            return;
        }
        const host = req.headers?.host;
        if (!isHostAllowed(host)) {
            res.statusCode = 403;
            res.setHeader("Content-Type", "text/plain");
            res.end(getBlockedHostMessage(host));
            return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", getContentType(found.fileName));
        res.setHeader("Content-Length", Buffer.byteLength(found.content));
        if (req.method === "HEAD") {
            res.end();
        } else {
            res.end(found.content);
        }
    };
