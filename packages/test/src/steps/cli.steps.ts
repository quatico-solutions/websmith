/* eslint-disable jest/no-jasmine-globals */
/* eslint-disable no-console */
import { createOptions } from "@quatico/websmith-cli";
import { CompilationContext, Compiler } from "@quatico/websmith-compiler";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { StepDefinitions } from "jest-cucumber";
import parseArgs from "minimist";
import { basename, dirname, isAbsolute, join, resolve } from "path";

const cleanWorkspace = true;

export const cliSteps: StepDefinitions = ({ given, when, then }) => {
    let compiler: Compiler;
    let projectDir: string;
    let rootDir: string;
    let context: CompilationContext;

    beforeAll(() => {
        projectDir = resolve("./test-source");
        rootDir = process.cwd();
    });

    beforeEach(() => {
        if (!existsSync(projectDir)) {
            mkdirSync(projectDir);
        }
        if (!existsSync(join(projectDir, "src"))) {
            mkdirSync(join(projectDir, "src"));
        }
        process.chdir(projectDir);
        writeFileSync(
            "./websmith.config.json",
            JSON.stringify({
                addonsDir: "./addons",
            })
        );
        writeFileSync(
            "./tsconfig.json",
            JSON.stringify({
                compilerOptions: {
                    target: "ESNEXT",
                    module: "ESNEXT",
                    lib: ["es2017", "es7", "es6", "dom"],
                    declaration: true,
                    outDir: "dist",
                    strict: true,
                    esModuleInterop: true,
                },
                include: ["src"],
                exclude: ["node_modules", "dist"],
            })
        );
    });

    afterEach(() => {
        process.chdir(rootDir);
        if (cleanWorkspace && existsSync(projectDir)) {
            rmSync(projectDir, { recursive: true });
        }
    });

    given(/^A valid config file named "(.*)" exists in project folder$/, (configPath: string) => {
        const resolvedConfigPath = resolvePath(configPath);
        writeFileSync(resolvedConfigPath, JSON.stringify({ addonsDir: "./addons" }));
    });

    given(/^Config file "(.*)" contains "(.*)" with "(.*)"$/, (configPath: string, cfgProp: string, cfgValue: string) => {
        const resolvedConfigPath = resolvePath(configPath);
        const content = JSON.parse(readFileSync(resolvedConfigPath, "utf-8").toString());
        content[cfgProp] = stringToList(cfgValue);
        writeFileSync(resolvedConfigPath, JSON.stringify(content));
    });

    given(/^Config file "(.*)" contains target "(.*)"$/, (configPath: string, targetNames: string) => {
        const resolvedConfigPath = resolvePath(configPath);
        const content = JSON.parse(readFileSync(resolvedConfigPath, "utf-8").toString());
        const targets: string[] = stringToList(targetNames);

        content.targets = { ...(content.targets ?? {}), ...targets.map(it => ({ [it]: {} })) };
        writeFileSync(resolvedConfigPath, JSON.stringify(content));
    });

    given(/^Folder "(.*)" contains addons "(.*)"$/, (addonsDir: string, addonNames: string) => {
        const addonsDirPath = resolvePath(addonsDir);
        stringToList(addonNames).forEach(addon => {
            copyFolderRecursiveSync(join(__dirname, "../test-data/addons/", addon), addonsDirPath);
        });
    });

    given(/^Folder "(.*)" contains addon examples "(.*)"$/, (addonsDir: string, addonNames: string) => {
        const addonsDirPath = resolvePath(addonsDir);
        stringToList(addonNames).forEach(addon => {
            copyFolderRecursiveSync(join(__dirname, "../../../examples/addons/", addon), addonsDirPath);
        });
    });

    given(/^Target project contains a module "(.*)" with a function is named "(.*)"$/, (moduleName: string, funcName: string) => {
        const modulePath = resolvePath("src", moduleName);
        writeFileSync(modulePath, `export const ${funcName} = () => { };`);
    });

    given(/^A test project "(.*)" is provided$/, (projectName: string) => {
        copyFolderRecursiveSync(join(__dirname, "../test-data/projects/", projectName), projectDir, "files");
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

        compiler = new Compiler(createOptions({ ...parseArgs(args), buildDir: "./dist", project: "./tsconfig.json" }));
        compiler.compile();
        context = compiler.getContext()!;
    });

    then(/^Addons "(.*)" should be activated in compilation$/, (addonNames: string) => {
        const addons: string[] = stringToList(addonNames);

        expect(
            compiler
                .getOptions()
                .addons.getAddons()
                .map(cur => cur.name)
        ).toEqual(addons);
    });

    then(/^Addons "(.*)" should not be activated$/, (addonNames: string) => {
        const addons = stringToList(addonNames);

        addons.forEach(addon => {
            expect(
                compiler
                    .getOptions()
                    .addons.getAddons()
                    .map(cur => cur.name)
            ).not.toContain(addon);
        });
    });

    then(/^A file "(.*)" exists containing string "(.*)"$/, (outFileName: string, funcName: string) => {
        const outFilePath = resolvePath(`${outFileName}`);
        expect(readFileSync(outFilePath, "utf-8").toString()).toContain(funcName);
    });

    then(/^A file content "(.*)" exists containing string "(.*)"$/, (outFileName: string, funcName: string) => {
        const outFilePath = resolvePath(`${outFileName}`);
        expect(context.getFileContent(outFilePath)).toContain(funcName);
    });

    then(/^A file "(.*)" exists containing names "(.*)"$/, (fileName: string, contents: string) => {
        const filePath = resolvePath(fileName);
        const expectedElements = stringToList(contents);

        const actualContent = readFileSync(filePath, "utf-8").toString();
        expectedElements.forEach(element => {
            expect(actualContent).toContain(element);
        });
    });

    then(
        /^Every call to function "(.*)" in "(.*)" should be replaced with "(.*)" in "(.*)"$/,
        (oldFuncName: string, oldFileName: string, newFuncName: string, newFileName: string) => {
            const oldContent = readFileSync(oldFileName, "utf-8").toString();
            const newContent = readFileSync(newFileName, "utf-8").toString();

            expect(newContent.trim()).toBe(oldContent.replaceAll(oldFuncName, newFuncName).trim());
        }
    );
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

const copyFolderRecursiveSync = (source: string, target: string, kind: "folder" | "files" = "folder") => {
    let files = [];
    // Check if folder needs to be created or integrated
    let targetFolder = join(target, basename(source));
    if (kind === "files") {
        targetFolder = join(dirname(target), "test-source");
    }
    if (!existsSync(targetFolder)) {
        mkdirSync(targetFolder, { recursive: true });
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

const resolvePath = (...configPath: string[]) => {
    let resolvedPath = join(...configPath);
    if (!isAbsolute(resolvedPath)) {
        resolvedPath = join(process.cwd(), ...configPath);
    }
    return resolvedPath;
};

const stringToList = (stringValue: string): string[] => {
    let result: string[] = [stringValue];
    if (stringValue.indexOf(",") > -1) {
        result = stringValue
            .split(",")
            .map(cur => cur.trim())
            .filter(cur => cur.length > 0);
    }
    return result;
};
