/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { loadFeatures, autoBindSteps } from "jest-cucumber";
import { cliSteps } from "./steps/cli.steps";

const features = loadFeatures("src/features/**/*.feature", { tagFilter: "not @skip" });
autoBindSteps(features, [cliSteps]);

describe.skip("empty", () => {
    it.skip("empty", () => undefined);
});
