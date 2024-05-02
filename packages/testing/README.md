<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->
# Websmith Testing API

This library provides a simple API for testing Websmith addons in your project.

## Installation

```bash
npm add -D @quatico/websmith-testing
```

## Usage: Test addon with an existing test project

Compile a project with from an existing folder in `test-data/projects` with
a addon from the `addons` folder in your filesystem.

```typescript
// foobar-addon.test.ts
import { compilationEnv } from '@quatico/websmith-testing';

describe('FoobarAddon', () => {
  it('should compile', () => {
    const results = compilationEnv('/target')
        .addAddons(['foobar-addon'], "../addons")
        .addProject("simple-example", "../test-data/projects")
        .compile();
   
    expect(fileContent("simple.js")).toMatchInlineSnapshot(`
      "import { foo } from 'foobar-addon';
        foo();
      "
    `);
  });
});
```

Please note that the whole compilation is done in memory and no files are written to disk. If you want to write the compiled files to disk, you can use the options `virtual: false`:

```typescript
// foobar-addon.test.ts
import { compilationEnv, type CompilationEnv } from '@quatico/websmith-testing';

let compilation: CompilationEnv;

afterEach(() => {
    // Remove the compilation results from your disk
    compilation.cleanup();
});

describe('FoobarAddon', () => {
  it('should compile', () => {
    const compilation = compilationEnv('/target', { virtual: false });

    // Use the example from above
    // Add addon and project to the compilation environment
  });
});

```

## Usage: Test addon with virtual file content from your test

You can define the project files to be used to test your addon directly within your test:

```typescript
// foobar-addon.test.ts
import { compilationEnv } from '@quatico/websmith-testing';

describe('FoobarAddon', () => {
  it('should compile', () => {
    const results = compilationEnv('/target').addProject("expected-project", {
            "./foo-bar/index.ts": `export * from "./target";`,
            "./foo-bar/target.ts": `export class Target {}`,
        })
        .addAddons(['foobar-addon'], "../addons")
        .compile();

        // expect the compilation results
  });
});
```
