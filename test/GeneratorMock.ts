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
import { Generator } from "../src/addon-api";

const GeneratorMock: Generator = jest.fn();

// const GeneratorMock = (config: MockConfig = {}): Generator => ({
//     emit: config.emit ?? jest.fn().mockReturnValue({}),
//     process: config.process ?? jest.fn(),
// });

// interface MockConfig {
//     emit?: any;
//     process?: any;
// }

export { GeneratorMock };
