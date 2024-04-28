import { AddonRegistry, Compiler } from "@quatico/websmith-core";
import ts from "typescript";
import { resolvePath } from "./paths";

export const activeAddons = (compilerOrRegistry: Compiler | AddonRegistry) => {
    const target = isCompiler(compilerOrRegistry) ? compilerOrRegistry.getOptions().addons : compilerOrRegistry;
    return target.getAvailableAddons().map(cur => cur.name);
};

export const fileContent = (system: ts.System, filePath: string, projectDir = process.cwd()): string | undefined =>
    system.readFile(resolvePath(system, projectDir, `${filePath}`), "utf-8");

export const pathExists = (system: ts.System, ...filePaths: string[]): boolean =>
    filePaths.reduce(
        (acc, it) => acc && (system.fileExists(resolvePath(system, `${it}`)) || system.directoryExists(resolvePath(system, `${it}`))),
        true
    );

const isCompiler = (compilerOrRegistry: Compiler | AddonRegistry): compilerOrRegistry is Compiler =>
    compilerOrRegistry instanceof Compiler && !("getAddons" in compilerOrRegistry);
