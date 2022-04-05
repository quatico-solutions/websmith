/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
import { createSystem } from "@websmith/compiler";
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
