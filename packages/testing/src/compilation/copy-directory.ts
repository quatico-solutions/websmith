/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { join } from "path";
import type ts from "typescript";

type SourcePath = {
    system: ts.System;
    path: string;
    kind: "project" | "addons";
};

type SourceFilePath = SourcePath & {
    subDirName: string;
};

type TargetPath = {
    system: ts.System;
    path: string;
};

export const copyDirectory = (source: SourcePath, target: TargetPath) => {
    const { system: srcSystem, path: srcPath, kind } = source;

    // Throw an error if the source directory does not exist for addons
    if (kind === "addons" && !srcSystem.directoryExists(srcPath)) {
        throw new Error(`Source directory ${srcPath} does not exist.`);
    }

    // Create target directory if it does not exist
    if (!target.system.directoryExists(target.path)) {
        target.system.createDirectory(target.path);
    }

    srcSystem.readDirectory(srcPath).forEach(file => {
        if (srcSystem.directoryExists(file)) {
            copyDirectory({ ...source, path: file }, target);
        } else {
            const subDirName = srcPath.substring(srcPath.lastIndexOf("/"));
            copyFile({ ...source, subDirName, path: file }, target);
        }
    });
};

const copyFile = (source: SourceFilePath, target: TargetPath) => {
    const { system: srcSystem, path: srcPath, subDirName, kind } = source;

    const fileContent = srcSystem.readFile(srcPath);
    if (typeof fileContent === "string") {
        let filePath;
        if (kind === "addons") {
            // TODO: target file path seems somewhat off, it sometimes includes the subDirName twice when addons are copied
            filePath = srcPath.substring(
                // Don't add the subDirName to the target path if it's already included
                srcPath.indexOf(subDirName) + (kind === "addons" && target.path.includes(subDirName) ? subDirName.length + 1 : 0)
            );
        } else {
            // kind === "project"
            filePath = srcPath.substring(srcPath.indexOf(subDirName) + subDirName.length + 1);
        }
        const targetPath = join(target.path, filePath);
        target.system.writeFile(targetPath, fileContent);
    }
};
