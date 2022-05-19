/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { AddonContext } from "./AddonContext";
import { ErrorMessage } from "./ErrorMessage";
import type { Generator } from "./Generator";
import { InfoMessage } from "./InfoMessage";
import { aggregateMessages, messageToString } from "./messages";
import type { Processor } from "./Processor";
import type { Reporter } from "./Reporter";
import type { TargetConfig } from "./TargetConfig";
import type { ResultProcessor } from "./ResultProcessor";
import { WarnMessage } from "./WarnMessage";

export type { AddonContext, Generator, TargetConfig, ResultProcessor, Processor, Reporter };
export { ErrorMessage, WarnMessage, InfoMessage, aggregateMessages, messageToString };
