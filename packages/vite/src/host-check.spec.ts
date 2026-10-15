/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createHostCheck, getBlockedHostMessage, isHostAllowed } from "./host-check";

describe("isHostAllowed", () => {
    it.each([
        ["localhost:5173"],
        ["localhost"],
        ["app.localhost:5173"],
        ["127.0.0.1:5173"],
        ["192.168.1.10"],
        ["[::1]:5173"],
        ["file://whatever"],
        ["chrome-extension://whatever"],
    ])("should return true w/o allowed hosts w/ %s", host => {
        const actual = isHostAllowed(host, []);

        expect(actual).toBe(true);
    });

    it.each([["evil.example"], ["evil.example:5173"], ["localhost.evil.example"], ["[::1"], ["[evil]:5173"], ["127.0.0.1.evil.example"]])(
        "should return false w/o allowed hosts w/ %s",
        host => {
            const actual = isHostAllowed(host, []);

            expect(actual).toBe(false);
        }
    );

    it("should return true w/ allowedHosts true", () => {
        const actual = isHostAllowed("evil.example", true);

        expect(actual).toBe(true);
    });

    it("should return true w/o host", () => {
        const actual = isHostAllowed(undefined, []);

        expect(actual).toBe(true);
    });

    it.each([
        ["app.example:5173", ["app.example"], true],
        ["other.example", ["app.example"], false],
        ["app.example", [".app.example"], true],
        ["sub.app.example", [".app.example"], true],
        ["evilapp.example", [".app.example"], false],
        ["sub.app.example", ["app.example"], false],
    ])("should match allowed hosts w/ %s and %j", (host, allowedHosts, expected) => {
        const actual = isHostAllowed(host, allowedHosts);

        expect(actual).toBe(expected);
    });

    it("should return true w/ host in additional allowed hosts", () => {
        const actual = isHostAllowed("dev.example:5173", [], ["dev.example"]);

        expect(actual).toBe(true);
    });
});

describe("createHostCheck", () => {
    it("should reject foreign host w/ allowed hosts of config", () => {
        const testObj = createHostCheck({ server: { allowedHosts: ["app.example"] } });

        const actual = [testObj("app.example"), testObj("evil.example")];

        expect(actual).toEqual([true, false]);
    });

    it("should allow host w/ additional allowed hosts of config", () => {
        const testObj = createHostCheck({ server: { allowedHosts: [] }, additionalAllowedHosts: ["dev.example"] });

        const actual = testObj("dev.example");

        expect(actual).toBe(true);
    });

    it("should allow any host w/ https", () => {
        const testObj = createHostCheck({ server: { allowedHosts: [], https: {} } });

        const actual = testObj("evil.example");

        expect(actual).toBe(true);
    });
});

describe("getBlockedHostMessage", () => {
    it("should name the host without port", () => {
        const actual = getBlockedHostMessage("evil.example:5173");

        expect(actual).toBe('Blocked request. This host ("evil.example") is not allowed.\nTo allow this host, add "evil.example" to `server.allowedHosts` in vite.config.js.');
    });
});
