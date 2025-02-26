/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createSystem as createCoreSystem } from "@quatico/websmith-core";
import type ts from "typescript";

export const createSystem = (files?: { [name: string]: string }): ts.System => {
    const raw = createCoreSystem(files);
    return {
        ...raw,
        watchFile: (path: string, callback: ts.FileWatcherCallback, pollingInterval?: number, options?: ts.WatchOptions): ts.FileWatcher => {
            return raw.watchFile
                ? raw.watchFile(path, callback, pollingInterval, options)
                : {
                      close: () => {
                          // do nothing
                      },
                  };
        },
    };
};
