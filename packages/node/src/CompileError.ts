export class CompileError extends Error {
    private stdout?: string;
    private stderr?: string;
    private reason?: string;

    constructor(message: string | Error) {
        super(typeof message === "string" ? message : message.message);
        this.name = "CompileError";
    }

    setStdout(stdout: string) {
        this.stdout = stdout.trim();
        return this;
    }

    setStderr(stderr: string) {
        this.stderr = stderr.trim();
        return this;
    }

    setReason(reason: string) {
        this.reason = reason.trim();
        return this;
    }

    getStdout() {
        return this.stdout;
    }

    getStderr() {
        return this.stderr;
    }

    getReason() {
        return this.reason;
    }
}
