/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
import memoize from "mem";
import { join } from "path";
// @ts-ignore no type desclaration
import picomatch from "picomatch";
import * as ts from "typescript";

export class VersionsMap {
    private data: ts.MapLike<{ version: number }> = {};

    constructor(private options: ProjectOptions) {
        this.options.files.forEach(file => this.add(file));
    }

    public add(filePath: string) {
        if (matches(filePath, this.options)) {
            this.data[filePath] = this.data[filePath] || { version: 1 };
        }
        return this;
    }
    public remove(filePath: string) {
        if (matches(filePath, this.options)) {
            delete this.data[filePath];
        }
        return this;
    }

    public increment(filePath: string) {
        const current = this.data[filePath];
        if (current) {
            current.version++;
        }
        return this;
    }

    public contains(filePath: string) {
        return !!this.data[filePath] || matches(filePath, this.options);
    }

    public getVersion(filePath: string): number | null {
        return this.data[filePath]?.version ?? null;
    }
}

const matches = memoize((filePath: string, options: ProjectOptions) => {
    const { excludes, includes, rootDir } = options;

    const isInclude = picomatch((includes || []).map(cur => join(rootDir, cur)));
    const isExclude = picomatch((excludes || []).map(cur => join(rootDir, cur)));

    if (!isInclude(filePath) || isExclude(filePath)) {
        return false;
    }
    return true;
});

export interface ProjectOptions {
    files: string[];
    excludes: string[];
    includes: string[];
    rootDir: string;
}
