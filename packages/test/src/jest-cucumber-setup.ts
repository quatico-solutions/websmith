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
import { loadFeatures, autoBindSteps } from "jest-cucumber";
import { cliSteps } from "./steps/cli.steps";

const features = loadFeatures("src/features/**/*.feature", { tagFilter: "not @skip" });
autoBindSteps(features, [cliSteps]);
