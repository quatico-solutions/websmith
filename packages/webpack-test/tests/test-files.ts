/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { CompilationConfig } from "@quatico/websmith-core";
import fs from "node:fs";
import path from "node:path";
import {} from "./compile-module-date.test";

export const writeWebsmithConfig = (config: Partial<CompilationConfig>, OUTPUT_DIR = path.join(__dirname, "..", "lib")) => {
    fs.mkdirSync(OUTPUT_DIR, {
        recursive: true,
    });
    fs.writeFileSync(path.join(OUTPUT_DIR, "websmith.config.json"), JSON.stringify(config), {
        encoding: "utf-8",
    });
};

export const getOutput = (filePath: string, OUTPUT_DIR = path.join(__dirname, "..", "lib")): string | undefined =>
    fs.existsSync(path.join(OUTPUT_DIR, filePath)) ? fs.readFileSync(path.join(OUTPUT_DIR, filePath), "utf-8") : undefined;
