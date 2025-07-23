import fs from "node:fs";
import path from "node:path";

/**
 * Function to get version from package.json at runtime.
 *
 * @returns The version of the package.
 */
export const getVersion = (): string => {
    try {
        const pathToPackageJson = path.join(__dirname, "..", "package.json");
        const packageJson = JSON.parse(fs.readFileSync(pathToPackageJson, "utf8"));
        return packageJson.version;
    } catch {
        return "unknown";
    }
};
