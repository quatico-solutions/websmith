import { createOptions } from "@quatico/websmith-compiler";
import { Compiler } from "@quatico/websmith-core";
import parseArgs from "minimist";

export const execute = (command: string) => {
    let cmd: string = command;
    if (cmd === "websmith") {
        cmd = "";
    } else if (cmd.startsWith("websmith ")) {
        cmd = cmd.replace("websmith ", "");
    }

    const args = cmd
        .replace(", ", ",")
        .split(" ")
        .map(it => it.trim())
        .filter(it => it.length > 0);

    const compiler = new Compiler(createOptions({ ...parseArgs(args), buildDir: "./dist", project: "./tsconfig.json" }));
    compiler.compile();
    const context = compiler.getContext()!;

    return { compiler, context };
};
