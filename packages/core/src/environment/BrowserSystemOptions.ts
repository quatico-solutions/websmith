/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type ts from "typescript";

export type BrowserSystemOptions = {
    useCaseSensitiveFileNames?: boolean;
    addLibDefaults?: boolean;
    fileWatcher?: ts.FileWatcherCallback;
    virtual?: boolean;
};
