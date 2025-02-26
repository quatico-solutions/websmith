import type ts from "typescript";

export type BrowserSystemOptions = {
    useCaseSensitiveFileNames?: boolean;
    addLibDefaults?: boolean;
    fileWatcher?: ts.FileWatcherCallback;
};
