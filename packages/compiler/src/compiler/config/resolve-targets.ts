/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
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
import { Reporter, WarnMessage } from "@websmith/addon-api";
import { CompilationConfig } from "./CompilationConfig";

// TODO: Target resolution: Passed targets in CLI vs. specified targets in CompilationConfig
//  Passed target this args.target
//  Specified targets in CompilationConfig
export const resolveTargets = (targets: string, config: CompilationConfig | undefined, reporter: Reporter) => {
    const passedTargets = targets
        .split(",")
        .map(it => it.trim())
        .filter(it => it.length > 0);
    const expectedTargets = Object.keys(config?.targets ?? {});
    const missingTargets = passedTargets.filter(cur => expectedTargets.length > 0 && !expectedTargets.includes(cur));
    if (missingTargets.length > 0) {
        reporter.reportDiagnostic(
            new WarnMessage(`Missing targets: The following targets are passed but not configured "${missingTargets.join(", ")}"`)
        );
    }
    return passedTargets;
};
