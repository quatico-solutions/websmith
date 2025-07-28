/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { CompilationConfig } from "@quatico/websmith-core";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export const writeWebsmithConfig = (config: Partial<CompilationConfig>, PROJECT_DIR = path.join(__dirname, "..", "output")) => {
    fs.mkdirSync(PROJECT_DIR, {
        recursive: true,
    });
    fs.writeFileSync(path.join(PROJECT_DIR, "websmith.config.json"), JSON.stringify(config), {
        encoding: "utf-8",
    });
};

export const writeTsConfig = (config: ts.CompilerOptions, PROJECT_DIR = path.join(__dirname, "..", "output")) => {
    fs.mkdirSync(PROJECT_DIR, {
        recursive: true,
    });

    // Convert enum values to strings for proper JSON serialization
    const normalizedConfig = {
        ...config,
        ...(config.target !== undefined && {
            target: ts.ScriptTarget[config.target] === "Latest" ? "esnext" : ts.ScriptTarget[config.target].toLowerCase(),
        }),
        ...(config.module !== undefined && { module: ts.ModuleKind[config.module].toLowerCase() }),
        ...(config.jsx !== undefined && { jsx: ts.JsxEmit[config.jsx].toLowerCase() }),
        ...(config.moduleResolution !== undefined && { moduleResolution: ts.ModuleResolutionKind[config.moduleResolution].toLowerCase() }),
    };

    fs.writeFileSync(path.join(PROJECT_DIR, "tsconfig.json"), JSON.stringify({ compilerOptions: normalizedConfig }), {
        encoding: "utf-8",
    });
};

export const getOutput = (filePath: string, OUTPUT_DIR = path.join(__dirname, "..", "output", "lib")): string | undefined =>
    fs.existsSync(path.join(OUTPUT_DIR, filePath)) ? fs.readFileSync(path.join(OUTPUT_DIR, filePath), "utf-8") : undefined;

export const writeSourceFile = (filePath: string, content: string, PROJECT_DIR = path.join(__dirname, "..", "output")) => {
    const fullPath = path.join(PROJECT_DIR, filePath);
    const dir = path.dirname(fullPath);

    // Create directory structure if it doesn't exist
    fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(fullPath, content, { encoding: "utf-8" });
};
