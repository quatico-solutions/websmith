export const stringToArray = (valueOrCommaSeparated: string): string[] => {
    let result: string[] = [valueOrCommaSeparated];
    if (valueOrCommaSeparated.indexOf(",") > -1) {
        result = valueOrCommaSeparated
            .split(",")
            .map(cur => cur.trim())
            .filter(cur => cur.length > 0);
    }
    return result;
};
