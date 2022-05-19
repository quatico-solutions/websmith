/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createSystem } from "@quatico/websmith-compiler";
import ts from "typescript";

export const compileSystem = (files?: { [name: string]: string }): ts.System => {
    const raw = createSystem(files);
    return {
        ...raw,
        watchFile: (path: string, callback: ts.FileWatcherCallback, pollingInterval?: number, options?: ts.WatchOptions): ts.FileWatcher => {
            process.stdout.write(`Watching: "${path.substring(path.lastIndexOf("/") + 1)}"\n`);
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
