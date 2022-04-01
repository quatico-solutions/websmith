import { createBrowserSystem } from "../../environment";
import { NoReporter } from "../NoReporter";
import { resolveCompilerConfig } from "./resolve-compiler-config";

const testSystem = createBrowserSystem({});

describe("resolveCompilerConfig", () => {
    it("should return undefined w/ empty path", () => {
        const actual = resolveCompilerConfig("", new NoReporter(), testSystem);

        expect(actual).toBeUndefined();
    });

    it("should return undefined w/ non-existing path", () => {
        const actual = resolveCompilerConfig("/does-not-exists.json", new NoReporter(), testSystem);

        expect(actual).toBeUndefined();
    });

    it("should return undefined w/ existing path but invalid config file", () => {
        testSystem.writeFile("./invalid-config.json", "");
        const actual = resolveCompilerConfig("./invalid-config.json", new NoReporter(), testSystem);

        expect(actual).toBeUndefined();
    });

    it("should return defaults w/ existing path and empty config file", () => {
        testSystem.writeFile("./empty-config.json", "{}");
        const actual = resolveCompilerConfig("./empty-config.json", new NoReporter(), testSystem);

        expect(actual).toEqual({
            configFilePath: "/empty-config.json",
        });
    });
});
