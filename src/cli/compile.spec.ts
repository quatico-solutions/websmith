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
// FIXME: Add cli test once environment is fixed
// jest.mock("../compiler", () => ({
//     Compiler: class TestCompiler {
//         public compile() {
//             return 0;
//         }
//     },
// }));
// jest.mock("./find-config");
// import { compile } from "./compile";

// // @ts-ignore
// process.stdout = jest.fn();

// beforeEach(() => {
//     jest.clearAllMocks();
// });

describe.skip("compile", () => {
    it.skip("should", () => {
        // @ts-ignore
        process.exit = jest.fn();

        // compile([]);

        expect(process.exit).toHaveBeenCalledWith("0");
    });
});
