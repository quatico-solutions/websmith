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
import { isStyleFile } from "../elements";
import { createBrowserSystem, getVersionedFile } from "../environment";
import { CustomProcessors } from "./addon-registry";
import { createProcessorTransformer } from "./processor-transformer";

const testSystem = createBrowserSystem({
    "one.ts": `
        @customElement("my-element")
        export class MyElement extends LitElement {}
    `,
    "_two.scss": `
        .my-element:after {
            content: "expected";
        }
    `,
    "_styles.scss": `
        .foo { display: none; }
    `,
});

describe("createProcessorTransformer", () => {
    it("calls element processor with element file", () => {
        const target = jest.fn();
        const file = getVersionedFile("one.ts", testSystem)!;

        setup({ element: [jest.fn().mockReturnValue(target)] }).transform(file);

        expect(target).toHaveBeenCalledWith(file);
    });

    it("calls styles processor with style file", () => {
        const target = jest.fn();
        const file = getVersionedFile("_two.scss", testSystem)!;

        expect(file).toBeDefined();
        expect(isStyleFile(file)).toBe(true);

        setup({ styles: [jest.fn().mockReturnValue(target)] }).transform(file);

        expect(target).toHaveBeenCalledWith(file);
    });
});

describe("createSourceFile", () => {
    it("Returns source files for non-TS files", () => {
        const actual = getVersionedFile("_styles.scss", testSystem)!;

        expect(actual.fileName).toBe("_styles.scss");
    });
});

const setup = (processors: CustomProcessors) => {
    const transformOf = createProcessorTransformer(processors);
    return {
        transform: transformOf({} as any),
    };
};
