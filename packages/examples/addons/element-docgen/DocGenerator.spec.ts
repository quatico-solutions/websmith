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
import * as ts from "typescript";
import { ReporterMock } from "../../../compiler/test";
import { tsDefaults, createBrowserSystem, createCompileHost, createVersionedFiles, readFiles } from "@websmith/compiler";
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

        // FIXME: Implement new interface
        testObj.getResultProcessor([file!.fileName!], mockContext);

        expect(testObj.getResults()[0].componentDefinitions[0].tagName).toBe("my-element");
    });
});

const setup = (filePath: string, system: ts.System): { file: ts.SourceFile | undefined; program: ts.Program } => {
    const files = createVersionedFiles(readFiles([filePath], system), tsDefaults);
    // FIXME: Implement new interface
    const program = ts.createProgram([filePath], {}, createCompileHost(files as any, ts.sys));
    const file = program.getSourceFile(filePath);
    return { file, program };
};
