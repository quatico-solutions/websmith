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
export const tsLibMocks = () => {
    jest.mock(`!!raw-loader!typescript/lib/lib.dom.d.ts`, () => "lib.dom.d.ts", { virtual: true });
    jest.mock(`!!raw-loader!typescript/lib/lib.es2015.d.ts`, () => "lib.es2015.d.ts", { virtual: true });
    jest.mock(`!!raw-loader!typescript/lib/lib.es2015.collection.d.ts`, () => "lib.es2015.collection.d.ts", {
        virtual: true,
    });
    jest.mock(`!!raw-loader!typescript/lib/lib.es2015.core.d.ts`, () => "lib.es2015.core.d.ts", { virtual: true });
    jest.mock(`!!raw-loader!typescript/lib/lib.es2015.d.ts`, () => "lib.es2015.d.ts", { virtual: true });
    jest.mock(`!!raw-loader!typescript/lib/lib.es2015.generator.d.ts`, () => "lib.es2015.generator.d.ts", {
        virtual: true,
    });
    jest.mock(`!!raw-loader!typescript/lib/lib.es2015.iterable.d.ts`, () => "lib.es2015.iterable.d.ts", {
        virtual: true,
    });
    jest.mock(`!!raw-loader!typescript/lib/lib.es2015.promise.d.ts`, () => "lib.es2015.promise.d.ts", {
        virtual: true,
    });
    jest.mock(`!!raw-loader!typescript/lib/lib.es2015.proxy.d.ts`, () => "lib.es2015.proxy.d.ts", { virtual: true });
    jest.mock(`!!raw-loader!typescript/lib/lib.es2015.reflect.d.ts`, () => "lib.es2015.reflect.d.ts", {
        virtual: true,
    });
    jest.mock(`!!raw-loader!typescript/lib/lib.es2015.symbol.d.ts`, () => "lib.es2015.symbol.d.ts", { virtual: true });
    jest.mock(
        `!!raw-loader!typescript/lib/lib.es2015.symbol.wellknown.d.ts`,
        () => "lib.es2015.symbol.wellknown.d.ts",
        {
            virtual: true,
        }
    );
    jest.mock(`!!raw-loader!typescript/lib/lib.es5.d.ts`, () => "lib.es5.d.ts", { virtual: true });
};
