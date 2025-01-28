export const parseReasonFromStats = (stdout: string, stderr: string) => {
    const console = stderr || stdout;
    const firstLine = console.split("\n")[0];
    return firstLine?.toLowerCase().includes("error") ? firstLine : null;
};
