/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

export class Logger {
    constructor(private prefix: string) {}

    public log(message: string, ...optionalParams: any[]) {
        process.stdout.write(this.getMessage(message, ...optionalParams));
    }

    public error(message: string, ...optionalParams: any[]) {
        process.stderr.write(this.getMessage(message, ...optionalParams));
    }

    public warn(message: string, ...optionalParams: any[]) {
        process.stdout.write(this.getMessage(message, ...optionalParams));
    }

    public getMessage(message: string, ...optionalParams: any[]) {
        let text = message;
        if (optionalParams.length > 0) {
            text = `${text} ${JSON.stringify(optionalParams)}`;
        }
        if (this.prefix) {
            text = `${this.prefix} ${text}`;
        }
        return `${text}\n`;
    }
}
