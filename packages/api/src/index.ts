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
import type { AddonContext } from "./AddonContext";
import { ErrorMessage } from "./ErrorMessage";
import type { Generator } from "./Generator";
import { InfoMessage } from "./InfoMessage";
import { aggregateMessages, messageToString } from "./messages";
import type { ProjectEmitter } from "./ProjectEmitter";
import type { Reporter } from "./Reporter";
import type { TargetConfig } from "./TargetConfig";
import type { Transformer } from "./Transformer";
import { WarnMessage } from "./WarnMessage";

export type { AddonContext, Generator, TargetConfig, ProjectEmitter, Transformer, Reporter };
export { ErrorMessage, WarnMessage, InfoMessage, aggregateMessages, messageToString };
