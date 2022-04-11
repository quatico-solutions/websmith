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
// tslint:disable:no-empty-interface

interface Value {
    name: string;
    description?: string;
}

interface ValueSet {
    name: string;
    values: Value[];
}

interface Member {
    name: string;
    description?: string;
    values?: Value[];
    valueSet?: string;
    // Suggested fields:
    type?: unknown;
    attribute?: string;
    deprecated?: boolean;
    deprecatedMessage?: string;
}

interface Attribute extends Member {
    // Suggested fields:
    default?: string;
}

export interface Method extends Member {
    privacy?: string;
    parameters?: string[];
}

export interface Mixin extends Member {
    privacy: string;
    parameters: string[];
}

interface Property extends Member {
    // Suggested fields:
    default?: string;
}

interface Slot extends Member {}

interface Event extends Member {}

export interface CssProperty extends Member {
    // Suggested fields:
    default?: string;
}

interface CssPart extends Member {}

export interface Tag {
    name: string;
    description?: string;
    attributes?: Attribute[];
    path?: string;
    // Suggested fields:
    properties?: Property[];
    slots?: Slot[];
    events?: Event[];
    methods?: Method[];
    cssProperties?: CssProperty[];
    cssParts?: CssPart[];
    deprecated?: boolean;
    deprecatedMessage?: string;
}

export interface Element {
    version: string;
    tags?: Tag[];
    valueSets?: ValueSet[];
    // Suggested fields:
    global?: {
        attributes?: Member[];
        properties?: Member[];
        slots?: Member[];
        events?: Member[];
    };
}
