import { join } from "path";
import ts from "typescript";

export const copyDirectory = (system: ts.System, source: string, target: string, kind: "project" | "addon") => {
    // Throw an error if the source directory does not exist for addons
    if (kind === "addon" && !system.directoryExists(source)) {
        throw new Error(`Source directory ${source} does not exist.`);
    }

    // Create target directory if it does not exist
    if (!system.directoryExists(target)) {
        system.createDirectory(target);
    }

    system.readDirectory(source).forEach(file => {
        if (system.directoryExists(file)) {
            copyDirectory(system, file, target, kind);
        } else {
            const addonName = source.substring(source.lastIndexOf("/"));
            copyFile(system, addonName, file, target, kind);
        }
    });
};

const copyFile = (system: ts.System, subDirName: string, source: string, target: string, kind: "project" | "addon") => {
    const fileContent = system.readFile(source);
    if (typeof fileContent === "string") {
        // Create a new file with the same path relative to `buildDir`
        const targetPath = join(target, source.substring(source.indexOf(subDirName) + (kind === "project" ? subDirName.length + 1 : 0)));
        system.writeFile(targetPath, fileContent);
    }
};
