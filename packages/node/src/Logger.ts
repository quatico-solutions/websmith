/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_COLORS: Record<LogLevel, string> = {
    debug: "\x1b[36m", // Cyan
    info: "\x1b[32m", // Green
    warn: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
};

const RESET_COLOR = "\x1b[0m"; // Reset color

export class Logger {
    private debugEnabled: boolean = false;
    private colorEnabled: boolean = true;
    private indentLevel: number = 0;

    constructor(debugEnabled: boolean = false) {
        this.debugEnabled = debugEnabled;
        // Force enable colors for better visibility, but not in test environments
        this.colorEnabled = !process.env.NODE_ENV?.includes("test") && (process.stdout.isTTY || true);
    }

    public setDebugEnabled(enabled: boolean): void {
        this.debugEnabled = enabled;
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

    public log(message: string, ...optionalParams: any[]) {
        this.writeToStdout(this.formatMessage(message, "info", ...optionalParams));
    }

    public error(message: string, ...optionalParams: any[]) {
        this.writeToStderr(this.formatMessage(message, "error", ...optionalParams));
    }

    public warn(message: string, ...optionalParams: any[]) {
        this.writeToStdout(this.formatMessage(message, "warn", ...optionalParams));
    }

    public debug(message: string, ...optionalParams: any[]) {
        if (this.debugEnabled) {
            this.writeToStdout(this.formatMessage(message, "debug", ...optionalParams));
        }
    }

    public info(message: string, ...optionalParams: any[]) {
        this.writeToStdout(this.formatMessage(message, "info", ...optionalParams));
    }

    public success(message: string, ...optionalParams: any[]) {
        this.writeToStdout(this.formatMessage(message, "info", ...optionalParams));
    }

    public step(message: string, ...optionalParams: any[]) {
        this.writeToStdout(this.formatMessage(message, "info", ...optionalParams));
    }

    private formatMessage(message: string, level: LogLevel, ...optionalParams: any[]): string {
        let text = message;
        if (optionalParams.length > 0) {
            text = `${text} ${JSON.stringify(optionalParams)}`;
        }

        const indent = "  ".repeat(this.indentLevel);
        const timestamp = new Date().toISOString();

        // Wrap configuration values in quotes for better readability
        // Only quote values that look like configuration settings, avoiding simple messages
        let quotedText = text;
        // Disable quoting in test environments
        if (
            !process.env.NODE_ENV?.includes("test") &&
            !text.includes("Error:") &&
            !text.includes("Warning:") &&
            (text.includes("tsconfig:") ||
                text.includes("addonsDir:") ||
                text.includes("target:") ||
                text.includes("module:") ||
                text.includes("strict:") ||
                text.includes("sourceMap:") ||
                text.includes("declaration:") ||
                text.includes("Project directory:") ||
                text.includes("Processing profile:") ||
                text.includes("Created TypeScript program with"))
        ) {
            // Only apply quoting for specific configuration patterns
            quotedText = text.replace(/(\w+):\s*([^,\s]+(?:\.[^,\s]+)*)/g, '$1: "$2"');
        }

        if (this.colorEnabled) {
            const color = LOG_COLORS[level];
            // New structured format without scope
            return `${indent}${color}[${timestamp}] [${level.toUpperCase()}] ${quotedText}${RESET_COLOR}\n`;
        }

        // New structured format without scope (no color)
        return `${indent}[${timestamp}] [${level.toUpperCase()}] ${quotedText}\n`;
    }

    private writeToStdout(message: string): void {
        process.stdout.write(message);
    }

    private writeToStderr(message: string): void {
        process.stderr.write(message);
    }

    public getMessage(message: string, ...optionalParams: any[]) {
        let text = message;
        if (optionalParams.length > 0) {
            text = `${text} ${JSON.stringify(optionalParams)}`;
        }
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [INFO] ${text}\n`; // Removed scope
    }
}
