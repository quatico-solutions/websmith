/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type PackageType } from "@quatico/websmith-core";

/** Key of a module's `buildInfo` that holds the package.json files whose `"type"` alone decided its build. */
export const PACKAGE_TYPES_KEY = "websmithPackageTypes";

type BuildInfo = Record<string, unknown> | undefined;
type PackageTypes = Record<string, PackageType | null>;

const getRecord = (buildInfo: BuildInfo): PackageTypes => (buildInfo?.[PACKAGE_TYPES_KEY] as PackageTypes | undefined) ?? {};

/** Records `packageTypes` in `buildInfo` as plain JSON, which webpack serializes with the module; nothing when empty. */
export const recordPackageTypes = (buildInfo: Record<string, unknown>, packageTypes: PackageTypes): void => {
    if (Object.keys(packageTypes).length > 0) {
        buildInfo[PACKAGE_TYPES_KEY] = { ...packageTypes };
    }
};

/** Returns the package.json files recorded in `buildInfo`. */
export const getRecordedPackageJsons = (buildInfo: BuildInfo): string[] => Object.keys(getRecord(buildInfo));

/** True when `readType` yields a type other than the recorded one for any package.json recorded in `buildInfo`. */
export const hasPackageTypeChanged = (buildInfo: BuildInfo, readType: (packageJson: string) => PackageType | null): boolean =>
    Object.entries(getRecord(buildInfo)).some(([packageJson, type]) => readType(packageJson) !== type);
