/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type ChildProcessWithoutNullStreams } from "node:child_process";
import { spawn } from "cross-spawn";
import { split } from "lodash";
import path from "node:path";
import tildify from "tildify";
import type ts from "typescript";
import { CompileError } from "../CompileError";
import { tsDefaults } from "../compiler-options";
import { Logger } from "../Logger";
import { parseCliArguments } from "./compiler-arguments";
import { parseReasonFromConsole } from "./console-output";
import { TSC_EXECUTABLE, findTsc } from "./find-tsc";

const tscProcessOptions = {
    env: process.env,
};

export class Compiler {
    private logger: Logger;
    private stdout: string;
    private stderr: string;
    private failedAlready: boolean;
    private tsConfig: ts.CompilerOptions;

    constructor(tsConfig?: ts.CompilerOptions) {
        this.logger = new Logger(`[tsc]`);
        this.stdout = "";
        this.stderr = "";
        this.failedAlready = false;
        this.tsConfig = tsConfig ?? tsDefaults;
    }

    public getTsConfig(): ts.CompilerOptions {
        return this.tsConfig;
    }

    public async compile(files?: string[]): Promise<string> {
        files = files ?? [];
        this.failedAlready = false;

        let tscPath: string;
        try {
            tscPath = await findTsc(this.logger);
        } catch (error) {
            return Promise.reject(error as Error);
        }

        const result = await new Promise<string>((resolve, reject) => {
            try {
                const tscCliArgs = parseCliArguments(this.tsConfig, files);
                this.logger.log(`✔ Found a typescript compiler at: "${tildify(tscPath)}"`);
                this.logger.log(`► Spawning the compilation command: "${[TSC_EXECUTABLE, ...tscCliArgs].join(" ")}"\n`);
                this.createProcess(tscPath, tscCliArgs, reject, resolve);
            } catch (error) {
                this.handleFailure(reject, `unexpected global catch`, new CompileError(error as Error));
            }
        });
        this.logger.log(`✔ Executed successfully.`);
        return result;
    }

    private createProcess(
        tscPath: string,
        tscArgs: string[],
        reject: (reason?: unknown) => void,
        resolve: (value: string | PromiseLike<string>) => void
    ) {
        const process = spawn(tscPath, tscArgs, tscProcessOptions);

        // listen to events
        this.connectError(process, reject);
        this.connectDisconnect(process);
        this.connectExit(process, resolve, reject);
        this.connectClose(process, resolve, reject);
        this.connectStdin(process, reject);
        this.connectStdout(process, reject);
        this.connectStderr(process, reject);

        return process;
    }

    private connectError(process: ChildProcessWithoutNullStreams, reject: (reason?: unknown) => void) {
        process.on("error", err => this.handleFailure(reject, 'Spawn: got event "err"', new CompileError(err)));
    }

    private connectDisconnect(process: ChildProcessWithoutNullStreams) {
        process.on("disconnect", () => this.logger.log(`Spawn: got event "disconnect"`));
    }

    private connectExit(
        process: ChildProcessWithoutNullStreams,
        resolve: (value: string | PromiseLike<string>) => void,
        reject: (reason?: unknown) => void
    ) {
        process.on("exit", (code, signal) => {
            if (code === 0) {
                resolve(this.stdout);
            } else {
                this.handleFailure(reject, `Spawn: got event "exit" with error code "${code}" & signal "${signal}"!`);
            }
        });
    }

    private connectClose(
        process: ChildProcessWithoutNullStreams,
        resolve: (value: string | PromiseLike<string>) => void,
        reject: (reason?: unknown) => void
    ) {
        process.on("close", (code, signal) => {
            if (code === 0) {
                resolve(this.stdout);
            } else {
                this.handleFailure(reject, `Spawn: got event "close" with error code "${code}" & signal "${signal}"`);
            }
        });
    }

    private connectStdin(process: ChildProcessWithoutNullStreams, reject: (reason?: unknown) => void) {
        process.stdin.on("data", data => this.logger.log(`got stdin event "data": "${data}"`));
        // mandatory for correct error detection
        process.stdin.on("error", err => this.handleFailure(reject, 'got stdin event "error"', new CompileError(err)));
    }

    private connectStdout(process: ChildProcessWithoutNullStreams, reject: (reason?: unknown) => void) {
        process.stdout.on("data", (data: string) => {
            split(data, "\n").forEach(line => {
                if (!line.length) {
                    return;
                } // convenience for more compact output

                if (line[0] === "/") {
                    line = tildify(line); // convenience for readability if using --listFiles
                }

                if (line.slice(-35) === "Starting incremental compilation...") {
                    this.logger.log("\n************************************");
                }

                this.logger.log(line);
            });
            this.stdout += data;
        });
        // mandatory for correct error detection
        process.stdout.on("error", err => this.handleFailure(reject, 'got stdout event "error"', new CompileError(err)));
    }

    private connectStderr(process: ChildProcessWithoutNullStreams, reject: (reason?: unknown) => void) {
        process.stderr.on("data", (data: string) => {
            split(data, "\n").forEach(line => this.logger.log(`${TSC_EXECUTABLE}! ${line}`));
            this.stderr += data;
        });
        // mandatory for correct error detection
        process.stderr.on("error", err => this.handleFailure(reject, 'got stderr event "error"', new CompileError(err)));
    }

    private handleFailure(reject: (error: CompileError) => void, reason: string, error?: CompileError) {
        if (this.failedAlready) {
            return;
        }

        error = error ?? new CompileError(`${parseReasonFromConsole(this.stdout, this.stderr) || reason}`);
        error.setStdout(this.stdout).setStderr(this.stderr).setReason(reason);

        this.logger.error(`✖ Failure during tsc invocation: ${reason}`);
        this.logger.error(error.message);

        error.message = this.logger.getMessage(`In directory '${path.parse(process.cwd()).base}' ${error.message}`);
        reject(error);
        this.failedAlready = true;
    }
}
