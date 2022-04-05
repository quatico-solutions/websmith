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
