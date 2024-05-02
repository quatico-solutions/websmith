import { join } from "path";
import ts from "typescript";

type SourcePath = {
    system: ts.System;
    path: string;
    kind: "project" | "addon";
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
    if (kind === "addon" && !srcSystem.directoryExists(srcPath)) {
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
        // Create a new file with the same path relative to `buildDir`
        const targetPath = join(target.path, srcPath.substring(srcPath.indexOf(subDirName) + (kind === "project" ? subDirName.length + 1 : 0)));
        target.system.writeFile(targetPath, fileContent);
    }
};
