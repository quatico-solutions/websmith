/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import net from "node:net";

/** The part of Vite's resolved config the host check reads. */
export type HostCheckConfig = {
    server: { allowedHosts: true | readonly string[]; https?: unknown };
    // Vite 6 keeps the hosts of server.host, server.hmr.host, preview.host and server.origin here; Vite 7 adds them to
    // server.allowedHosts instead
    additionalAllowedHosts?: readonly string[];
};

const FILE_OR_EXTENSION_PROTOCOL = /^(?:file|.+-extension):/i;

/**
 * Returns whether Vite's dev server allows a request with the `Host` header `host`, by Vite's rules: any host with
 * `allowedHosts` true, an IP address, `localhost` and its subdomains, a host of `allowedHosts` or
 * `additionalAllowedHosts`, and a subdomain of an entry that starts with a dot. A request without `Host` passes, as in
 * Vite 7, since only a browser, which always sends one, is what the check protects.
 *
 * Vite exports no such function, so this one follows `hostCheckMiddleware` of Vite 6 and `host-validation-middleware`
 * of Vite 7.
 */
export const isHostAllowed = (
    host: string | undefined,
    allowedHosts: true | readonly string[],
    additionalAllowedHosts: readonly string[] = []
): boolean => {
    if (allowedHosts === true || host === undefined || FILE_OR_EXTENSION_PROTOCOL.test(host)) {
        return true;
    }
    const trimmed = host.trim();
    if (trimmed.startsWith("[")) {
        const end = trimmed.indexOf("]");
        return end >= 0 && net.isIP(trimmed.slice(1, end)) === 6;
    }
    const colon = trimmed.indexOf(":");
    const hostname = colon === -1 ? trimmed : trimmed.slice(0, colon);
    if (net.isIP(hostname) === 4 || hostname === "localhost" || hostname.endsWith(".localhost")) {
        return true;
    }
    return [...additionalAllowedHosts, ...allowedHosts].some(
        cur => cur === hostname || (cur.startsWith(".") && (cur.slice(1) === hostname || hostname.endsWith(cur)))
    );
};

/**
 * Creates the host check of the dev server with `config`. Like Vite, it allows every host with `server.https`, where
 * Vite checks no host either.
 */
export const createHostCheck =
    ({ server, additionalAllowedHosts }: HostCheckConfig) =>
    (host: string | undefined): boolean =>
        Boolean(server.https) || isHostAllowed(host, server.allowedHosts, additionalAllowedHosts);

/** The body of Vite's 403 response to a host it does not allow. */
export const getBlockedHostMessage = (host: string | undefined): string => {
    const hostname = JSON.stringify(host?.replace(/:\d+$/, "") ?? "");
    return (
        `Blocked request. This host (${hostname}) is not allowed.\n` +
        `To allow this host, add ${hostname} to \`server.allowedHosts\` in vite.config.js.`
    );
};
