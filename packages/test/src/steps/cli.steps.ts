import { Command } from "commander";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { StepDefinitions } from "jest-cucumber";
import { basename, join } from "path";
import { addCompileCommand } from "../../src/cli";

console.log = jest.fn();

export const cliSteps: StepDefinitions = ({ given, when, then }) => {
    given(/^A valid config file named "(.*)" exists in project folder$/, (configPath: string) => {
        let resolvedPath = configPath;
        if (configPath.startsWith("./")) {
            resolvedPath = join(process.cwd(), configPath);
        }
        writeFileSync(resolvedPath, "{}");
    });

    given(/^Config file "(.*)" contains "(.*)" with "(.*)"$/, (configPath: string, cfgProp: string, cfgValue: string) => {
        let resolvedPath = configPath;
        if (configPath.startsWith("./")) {
            resolvedPath = join(process.cwd(), configPath);
        }
        const content = JSON.parse(readFileSync(resolvedPath, "utf-8").toString());
        if (cfgValue.indexOf(",") > -1) {
            content[cfgProp] = cfgValue
                .split(",")
                .map(it => it.trim())
                .filter(it => it.length > 0);
        } else {
            content[cfgProp] = cfgValue.trim();
        }
        writeFileSync(resolvedPath, JSON.stringify(content));
    });

    given(/^Config file "(.*)" contains target "(.*)"$/, (configPath: string, targetNames: string) => {
        let resolvedPath = configPath;
        if (configPath.startsWith("./")) {
            resolvedPath = join(process.cwd(), configPath);
        }
        const content = JSON.parse(readFileSync(resolvedPath, "utf-8").toString());
        let targets: string[] = [targetNames];
        if (targetNames.indexOf(",") > -1) {
            targets = targetNames
                .split(",")
                .map(it => it.trim())
                .filter(it => it.length > 0);
        }

        content.targets = { ...(content.targets ?? {}), ...targets.map(it => ({ [it]: {} })) };
        writeFileSync(resolvedPath, JSON.stringify(content));
    });

    given(/^Folder "(.*)" contains addons "(.*)"$/, (addonsDir: string, addonNames: string) => {
        let resolvedPath = addonsDir;
        if (addonsDir.startsWith("./")) {
            resolvedPath = join(process.cwd(), addonsDir);
        }

        let addons: string[] = [addonNames];
        if (addonNames.indexOf(",") > -1) {
            addons = addonNames
                .split(",")
                .map(it => it.trim())
                .filter(it => it.length > 0);
        }

        addons.forEach(addon => {
            const addonPath = join("/", addonsDir, addon, "addon");
            console.error("XXX", addonPath);
            copyFolderRecursiveSync(join(__dirname, "../test-data/addons/", addon), join(resolvedPath, addon));
            jest.mock(
                addonPath,
                () => {
                    return { activate: jest.fn() };
                },
                { virtual: true }
            );
        });
    });

    given(/^Target project contains a module "(.*)" with a function is named "(.*)"$/, (moduleName: string, funcName: string) => {
        const modulePath = join(process.cwd(), "src", moduleName);
        writeFileSync(modulePath, `export const ${funcName} = () => {}`);
    });

    when(/^User calls command "(.*)"$/, cliCommand => {
        let command: string = cliCommand;
        if (command === "websmith") {
            command = "";
        } else if (command.startsWith("websmith ")) {
            command = command.replace("websmith ", "");
        }

        const args = command
            .replace(", ", ",")
            .split(" ")
            .map(it => it.trim())
            .filter(it => it.length > 0);

        addCompileCommand(new Command()).parse(args, { from: "user" });
    });

    then(/^Addons "(.*)" should be applied during compilation$/, (addonName: string) => {
        expect(console.log).toHaveBeenCalledWith(`Addon "${addonName}" applied.`);
    });
    then(/^Addons "(.*)" should not be applied$/, addonName => {
        expect(console.log).not.toHaveBeenCalledWith(`Addon "${addonName}" applied.`);
    });
    then(/^Output file "(.*)" should contain a function named "(.*)"$/, (outFileName: string, funcName: string) => {
        const outFilePath = join(process.cwd(), "bin", outFileName);
        expect(readFileSync(outFilePath, "utf-8").toString()).toContain(funcName);
    });

    then(/^Every call to function "(.*)" should be replaced with "(.*)"$/, (oldFuncName: string, newFuncName: string) => {
        fail("Not implemented");
    });
    then("A YAML file is emitted containing names of all exported module members", () => {
        fail("Not implemented");
    });
};

const copyFileSyncFn = (source: string, target: string) => {
    let targetFile = target;
    // If target is a directory, a new file with the same name will be created
    if (existsSync(target)) {
        if (lstatSync(target).isDirectory()) {
            targetFile = join(target, basename(source));
        }
    }
    writeFileSync(targetFile, readFileSync(source));
};

const copyFolderRecursiveSync = (source: string, target: string) => {
    let files = [];
    // Check if folder needs to be created or integrated
    let targetFolder = join(target, basename(source));
    if (!existsSync(targetFolder)) {
        mkdirSync(targetFolder);
    }
    // Copy
    if (lstatSync(source).isDirectory()) {
        files = readdirSync(source);
        files.forEach(file => {
            const curSource = join(source, file);
            if (lstatSync(curSource).isDirectory()) {
                copyFolderRecursiveSync(curSource, targetFolder);
            } else {
                copyFileSyncFn(curSource, targetFolder);
            }
        });
    }
};
