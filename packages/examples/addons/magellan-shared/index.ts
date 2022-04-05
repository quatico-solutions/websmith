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
import {
    createInvokeImport,
    getDecoration,
    getDescendantsOfKind,
    getFunctionName,
    hasDecorator,
    hasInvokeImport,
    isNodeExported,
    isStatement,
    isTransformable,
} from "./node-helpers";
import { transformInvocableArrow, transformInvocableFunction, transformLocalServerArrow, transformLocalServerFunction } from "./transform-function";
import { TransformationArguments } from "./TransformationArguments";

export {
    getDescendantsOfKind,
    getDecoration,
    getFunctionName,
    createInvokeImport,
    hasInvokeImport,
    isStatement,
    isTransformable,
    hasDecorator,
    isNodeExported,
    transformInvocableArrow,
    transformInvocableFunction,
    transformLocalServerArrow,
    transformLocalServerFunction,
};

export type { TransformationArguments };
