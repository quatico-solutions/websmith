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
