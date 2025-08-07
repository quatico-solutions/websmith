/* eslint-disable no-console */
type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_COLORS: Record<LogLevel, string> = {
    debug: "\x1b[36m", // Cyan
    info: "\x1b[32m", // Green
    warn: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
};

const RESET_COLOR = "\x1b[0m"; // Reset color

type ClassConstructor<T> = new (...args: unknown[]) => T;

/**
 * Logger class for logging messages with different severity levels.
 * This class provides methods to log messages at different levels (debug, info, warn, error).
 * It also formats the log messages with timestamps and colors.
 */
export class Logger {
    private scope: string = "default";
    private static maxLogLevel: LogLevel = "debug";

    private constructor() {}
    /**
     * Sets the maximum log level for the logger.
     * @param level - The maximum log level to set.
     */
    public static setMaxLogLevel(level: LogLevel): void {
        Logger.maxLogLevel = level;
    }

    /**
     * Creates a new instance of the Logger class.
     * @param scope - The scope of the logger, used to identify the source of the log messages.
     * @returns A new instance of the Logger class.
     */
    public static create<T>(scope: string | ClassConstructor<T> | undefined): Logger {
        const logger = new Logger();
        if (typeof scope === "string") {
            logger.scope = scope;
        } else if (scope) {
            logger.scope = scope.name;
        } else {
            logger.scope = "default";
        }
        return logger;
    }

    /**
     * Logs a debug message.
     * @param message - The message to log.
     */
    public debug(message: string): void {
        if (Logger.maxLogLevel !== "debug") {
            return;
        }
        console.debug(this.formatMessage("debug", message));
    }

    /**
     * Logs an info message.
     * @param message - The message to log.
     */
    public info(message: string): void {
        if (Logger.maxLogLevel === "warn" || Logger.maxLogLevel === "error") {
            return;
        }
        console.info(this.formatMessage("info", message));
    }

    /**
     * Logs a warning message.
     * @param message - The message to log.
     */
    public warn(message: string): void {
        if (Logger.maxLogLevel === "error") {
            return;
        }
        console.warn(this.formatMessage("warn", message));
    }

    /**
     * Logs an error message.
     * @param message - The message to log.
     */
    public error(message: string): void {
        console.error(this.formatMessage("error", message));
    }

    /**
     * Formats the log message with a timestamp and color based on the log level.
     * @param level - The severity level of the log message.
     * @param message - The log message to format.
     * @returns The formatted log message.
     */
    private formatMessage(level: LogLevel, message: string): string {
        const timestamp = new Date().toISOString();
        // eslint-disable-next-line max-len
        return `${LOG_COLORS[level]}[${timestamp}] [${level.toUpperCase()}] [${this.scope}] ${message}${RESET_COLOR}`;
    }
}
