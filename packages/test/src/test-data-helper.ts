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
import path from "path";

const fs = jest.requireActual("fs");

export const readE2eTestData = ({ name, dataType = "json" }: { name: string; dataType: string }): string => {
    return fs.readFileSync(path.resolve(__dirname, "__data__", dataType, `${name}.${dataType}`)).toString();
};
