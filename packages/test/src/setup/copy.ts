import { basename, join } from "path";
import ts from "typescript";

const copyFileSync = (system: ts.System, source: string, target: string) => {
    let targetFile = target;
    // If target is a directory, a new file with the same name will be created
    if (system.directoryExists(target)) {
        targetFile = join(target, basename(source));
    }
    const fileContent = system.readFile(source);
    if (fileContent) {
        system.writeFile(targetFile, fileContent);
    }
};

export const copyFolderSync = (system: ts.System, source: string, target: string) => {
    let files = [];
    // Check if folder needs to be created or integrated
    const targetFolder = join(target, basename(source));
    if (!system.directoryExists(targetFolder)) {
        system.createDirectory(targetFolder);
    }
    // Copy
    if (system.directoryExists(source)) {
        files = system.readDirectory(source);
        files.forEach(file => {
            const curSource = join(source, file);
            if (system.directoryExists(curSource)) {
                copyFolderSync(system, curSource, targetFolder);
            } else {
                copyFileSync(system, curSource, targetFolder);
            }
        });
    }
};
