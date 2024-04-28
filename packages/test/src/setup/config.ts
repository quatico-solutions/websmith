import ts from "typescript";
import { resolvePath } from "./paths";
import { stringToArray } from "./values";

export const websmithConfig = (system: ts.System, configPath: string, content?: object) => {
    const resolvedConfigPath = resolvePath(system, configPath);
    system.writeFile(resolvedConfigPath, JSON.stringify({ addonsDir: "./addons", ...content }));
};

export const setConfig = (system: ts.System, configPath: string, cfgProp: string, cfgValue: string) => {
    const resolvedConfigPath = resolvePath(system, configPath);
    const content = JSON.parse(system.readFile(resolvedConfigPath, "utf-8") ?? "{}") as Record<string, unknown>;
    content[cfgProp] = stringToArray(cfgValue);
    system.writeFile(resolvedConfigPath, JSON.stringify(content));
};

export const setTargets = (system: ts.System, configPath: string, targetNames: string) => {
    const resolvedConfigPath = resolvePath(system, configPath);
    const content = JSON.parse(system.readFile(resolvedConfigPath, "utf-8") ?? "{}") as { targets?: Record<string, unknown> };
    const targets: string[] = stringToArray(targetNames);

    content.targets = { ...(content.targets ?? {}), ...targets.map(it => ({ [it]: {} })) };
    system.writeFile(resolvedConfigPath, JSON.stringify(content));
};
