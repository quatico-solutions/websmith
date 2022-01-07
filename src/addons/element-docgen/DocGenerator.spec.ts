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
/* eslint-disable jest/no-mocks-import */
import ts from "typescript";
import { ReporterMock } from "../../__mocks__";
import { tsDefaults } from "../../compiler";
import { createBrowserSystem, createCompileHost, createVersionedFiles, readFiles } from "../../environment";
import { DocGenerator } from "./DocGenerator";

const testSystem = createBrowserSystem({
    "one.ts": `
        @customElement("my-element")
        export class MyElement extends LitElement {
        
            myProp = "myProp";
            
            @property({type: String}) 
            prop4 = "hello";
        
            @property({type: Boolean, attribute: "prop-5"}) 
            prop5;
            
            static get properties() {
                return {
                    prop1: { type: String },
                    prop2: { type: Number, attribute: "prop-two" },
                    prop3: { type: Boolean, attribute: false }
                };
            }        
        }`,
});

// FIXME: Implement
describe("XXX", () => {
    it.skip("XXX", () => {
        const mockContext = {} as any;

        const { file } = setup("one.ts", testSystem);
        const reporter = new ReporterMock(createBrowserSystem({}));

        const testObj = new DocGenerator({ reporter });

        testObj.process(mockContext)(file!);

        expect(testObj.getResults()[0].componentDefinitions[0].tagName).toBe("my-element");
    });
});

const setup = (filePath: string, system: ts.System): { file: ts.SourceFile | undefined; program: ts.Program } => {
    // @ts-ignore FIXME: Add files to options
    const files = createVersionedFiles(readFiles([filePath], system), tsDefaults);
    const options: ts.CompilerOptions = { ...tsDefaults, ...{ noEmit: true } };
    const program = ts.createProgram([filePath], {}, createCompileHost(options, ts.sys));
    const file = program.getSourceFile(filePath);
    return { file, program };
};
