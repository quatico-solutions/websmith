/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilationContext, createSystem, NoReporter } from "@quatico/websmith-core";
import { type LoaderContext } from "webpack";
import { TsCompiler } from "./TsCompiler";
import { type WebpackAddonContext } from "./WebpackAddonContext";
import { WebpackAddonService } from "./WebpackAddonService";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

const TS_CONFIG = { "/tsconfig.json": JSON.stringify({ compilerOptions: { target: "es2020", module: "esnext", outDir: "/dist", rootDir: "/src" } }) };

const createLoaderContext = () => ({ emitError: jest.fn(), emitWarning: jest.fn() }) as unknown as LoaderContext<WebsmithLoaderConfig>;

const createAddonCompiler = (loaderContext: LoaderContext<WebsmithLoaderConfig>, warn: WebsmithLoaderConfig["warn"] = jest.fn()): TsCompiler => {
    const system = createSystem({ ...TS_CONFIG, "/src/a.ts": "export const a = 1;" }, { virtual: true });
    system.createDirectory("/addons");
    return new TsCompiler(
        {
            config: { addonsDir: "/addons", profiles: { target: {} } },
            reporter: new NoReporter(),
            cliArgs: { options: {}, fileNames: ["/src/a.ts"], errors: [] },
        },
        { tsConfigFile: "/tsconfig.json", transpileOnly: true, profile: "target", warn },
        undefined,
        loaderContext,
        system
    );
};

describe("TsCompiler addon step", () => {
    beforeEach(() => {
        jest.spyOn(WebpackAddonService.prototype, "getAvailableAddons").mockReturnValue([]);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("passes addon failure to warn option w/ throwing addon context application", () => {
        jest.spyOn(WebpackAddonService.prototype, "applyAddonsToContext").mockImplementation(() => {
            throw new Error("Addon exploded");
        });
        const target = jest.fn();
        const testObj = createAddonCompiler(createLoaderContext(), target);

        testObj.build("/src/a.ts");
        const actual = target.mock.calls.map(([cur]) => cur.message);

        expect(actual).toEqual(["Addon processing failed: Addon exploded"]);
    });

    it("emits neither errors nor warnings w/ throwing addon context application", () => {
        jest.spyOn(WebpackAddonService.prototype, "applyAddonsToContext").mockImplementation(() => {
            throw new Error("Addon exploded");
        });
        const target = createLoaderContext();
        const testObj = createAddonCompiler(target);

        testObj.build("/src/a.ts");

        expect(target.emitError).not.toHaveBeenCalled();
        expect(target.emitWarning).not.toHaveBeenCalled();
    });

    it("yields no diagnostics w/ throwing addon context application", () => {
        jest.spyOn(WebpackAddonService.prototype, "applyAddonsToContext").mockImplementation(() => {
            throw new Error("Addon exploded");
        });
        const testObj = createAddonCompiler(createLoaderContext());

        const actual = testObj.build("/src/a.ts").diagnostics;

        expect(actual).toEqual([]);
    });

    it("runs no result processor of target profile w/ several builds", () => {
        const target = jest.fn();
        jest.spyOn(WebpackAddonService.prototype, "applyAddonsToContext").mockImplementation((context: CompilationContext) => {
            context.registerResultProcessor(target);
            return { hasGenerators: () => false, hasProcessors: () => false } as unknown as WebpackAddonContext;
        });
        const testObj = createAddonCompiler(createLoaderContext());

        ["/src/a.ts", "/src/a.ts", "/src/a.ts"].forEach(cur => testObj.build(cur));

        expect(target).not.toHaveBeenCalled();
    });
});
