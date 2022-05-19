/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
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
