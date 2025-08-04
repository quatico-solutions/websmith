/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { messageToString, type Reporter } from "@quatico/websmith-api";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_COLORS: Record<LogLevel, string> = {
    debug: "\x1b[36m", // Cyan
    info: "\x1b[32m", // Green
    warn: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
};

const RESET_COLOR = "\x1b[0m"; // Reset color

export class DefaultReporter implements Reporter {
    public readonly formatHost: ts.FormatDiagnosticsHost;
    private colorEnabled: boolean = true;
    private indentLevel: number = 0;

    constructor(host: ts.System | ts.FormatDiagnosticsHost) {
        this.formatHost = isSystem(host)
            ? {
                  getCanonicalFileName: (path: string) => path,
                  getCurrentDirectory: () => host.getCurrentDirectory(),
                  getNewLine: () => host.newLine,
              }
            : host;
        // Enable colors only if the terminal supports it and not in test environments
        this.colorEnabled = !process.env.NODE_ENV?.includes("test") && process.stdout.isTTY;
    }

    public setColorEnabled(enabled: boolean): void {
        this.colorEnabled = enabled;
    }

    public indent(): void {
        this.indentLevel++;
    }

    public unindent(): void {
        this.indentLevel = Math.max(0, this.indentLevel - 1);
    }

    public reportDiagnostic(diagnostic: ts.Diagnostic): void {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, this.formatHost.getNewLine());
        if (typeof diagnostic.file?.getLineAndCharacterOfPosition === "function" && diagnostic.start) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            this.logProblem(`${levelOf(diagnostic)}: ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`, diagnostic.category);
        } else {
            // For Message category, don't add the level prefix to avoid "Message:" prefix
            if (diagnostic.category === ts.DiagnosticCategory.Message) {
                this.logProblem(message, diagnostic.category);
            } else {
                this.logProblem(`${levelOf(diagnostic)}: ${diagnostic.code ? diagnostic.code + ": " : ""}${message}`, diagnostic.category);
            }
        }
    }

    /**
     * Prints a diagnostic every time the watch status changes, i.e., mainly
     * messages like "Starting compilation" or "Compilation completed".
     */
    public reportWatchStatus(diagnostic: ts.Diagnostic, newLine = ""): void {
        // console.info(ts.formatDiagnostic(diagnostic, this.formatHost));
        const message = `${messageToString(diagnostic.messageText)}${newLine}`;
        // Remove "Message:" prefix if present
        const cleanMessage = message.replace(/^Message:\s*/, "");
        this.writeColored(cleanMessage, "info");
    }

    protected logProblem(message: string, category: ts.DiagnosticCategory): void {
        let level: LogLevel;
        let icon = "";

        switch (category) {
            case ts.DiagnosticCategory.Error:
                level = "error";
                icon = "❌ ";
                break;
            case ts.DiagnosticCategory.Warning:
                level = "warn";
                icon = "⚠️  ";
                break;
            case ts.DiagnosticCategory.Suggestion:
                level = "info";
                icon = ""; // Remove prefix for suggestions
                break;
            case ts.DiagnosticCategory.Message:
                level = "info";
                icon = ""; // Remove prefix for messages
                break;
            default:
                level = "info";
                icon = "ℹ️  ";
                break;
        }
        this.writeColored(`${icon}${message}`, level);
    }

    private writeColored(message: string, level: LogLevel): void {
        const indent = "  ".repeat(this.indentLevel);

        // Get timestamp
        const timestamp = new Date().toISOString();

        // Wrap configuration values in quotes for better readability
        // Only quote values that look like configuration settings, avoiding simple messages
        let quotedMessage = message;
        // Disable quoting in test environments
        if (
            !isTestEnvironment() &&
            !message.includes("Error:") &&
            !message.includes("Warning:") &&
            (message.includes("tsconfig:") ||
                message.includes("addonsDir:") ||
                message.includes("target:") ||
                message.includes("module:") ||
                message.includes("strict:") ||
                message.includes("sourceMap:") ||
                message.includes("declaration:") ||
                message.includes("Project directory:") ||
                message.includes("Processing profile:") ||
                message.includes("Created TypeScript program with"))
        ) {
            // Only apply quoting for specific configuration patterns
            quotedMessage = message.replace(/(\w+):\s*([^,\s]+(?:\.[^,\s]+)*)/g, '$1: "$2"');
        }

        if (this.colorEnabled) {
            const color = LOG_COLORS[level];
            const output = level === "error" ? process.stderr : process.stdout;
            output.write(`${indent}${color}[${timestamp}] [${level.toUpperCase()}] ${quotedMessage}${RESET_COLOR}\n`);
        } else {
            const output = level === "error" ? process.stderr : process.stdout;
            output.write(`${indent}[${timestamp}] [${level.toUpperCase()}] ${quotedMessage}\n`);
        }
    }
}

const levelOf = (diagnostic: ts.Diagnostic): string => {
    if (diagnostic?.category === undefined) {
        diagnostic.category = ts.DiagnosticCategory.Error;
    }
    return ts.DiagnosticCategory[diagnostic.category];
};

const isSystem = (host: ts.System | ts.FormatDiagnosticsHost): host is ts.System => (host as ts.System).write !== undefined;

const isTestEnvironment = (): boolean => {
    return process.env.NODE_ENV?.includes("test") || process.env.JEST_WORKER_ID !== undefined;
};
