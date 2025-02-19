import type ts from "typescript";

export type CompileSystemOptions = {
    useCaseSensitiveFileNames?: boolean;
    addLibDefaults?: boolean;
    fileWatcher?: ts.FileWatcherCallback;
};
