<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->
# Websmith Testing API

This library strives to simplify compiler testing significantly. Setup the typescript compiler, customize projects settings, add custom compiler addons, and compile various projects within 5 lines of code. Use Unit Test style setup and assertions with Jest. Compile projects from the filesystem or from virtual file content and compare compiled results expected from the filesystem, or virtual snapshots.

The library can run tests, with

* Standard Jest test runner configuration and API
* Compiler addons written in TypeScript directly (no need to compile them upfront)
* A virtual file system, compile from and to memory, no need to write files to disk
* Mixed project and addon sources from the filesystem and virtual file content
* Navigate the project and compiled files with a simple API
* Compare compiled file contents with expected from the filesystem, or virtual snapshots

The library is designed to be used with Jest, but it can be used with any other test framework when the actual file system is used.

## 1 Installation and Setup

Install the library in your project, e.g. with npm:

```bash
npm add -D @quatico/websmith-testing
```

We don't add jest as a dependency, so you need to install it yourself!

### 1.1 Test your addon with virtual project files

Compile a project with from an existing folder in `test-data/projects` with
a addon from the `addons` folder in your filesystem.

```typescript
// foobar-addon.test.ts
import { compilationEnv } from '@quatico/websmith-testing';
import { join } from 'path';

describe('FoobarAddon', () => {
    it('should compile source files', () => {
        const results = compilationEnv('./__TEST__')
            .addAddon("my-addon", join(__dirname, "../addons"))
            .addProjectFromSource({
                "bar.ts": `console.log("Hello, Bar!");`,
                "foo.ts": `export class Foo<T> {
                    constructor(public value: T) {
                        console.log("Hello, Foo!", JSON.stringify(value));
                    }
                }`,
            })
            .compile();
    
        expect(testObj.getCompiledFiles().getPaths()).toEqual([
            "/__TEST__/dist/bar.js",
            "/__TEST__/dist/foo.js"
            "/__TEST__/dist/my-addon-output.json"
        ]);
        expect(results.getCompiledFile("foo.js").getContent()).toMatchInlineSnapshot(`
            "export class Foo {
                value;
                constructor(value) {
                    this.value = value;
                    console.log("Hello, Foo!", JSON.stringify(value));
                }
            }
            "
        `);
    });
});
```

The whole compilation is done in memory and no files are written to disk. If you want to write the compiled files to disk, you can add the option `virtual: false` to the compilation environment:

```typescript
// foobar-addon.test.ts
import { compilationEnv, type CompilationEnv } from '@quatico/websmith-testing';
import { join } from 'path';

let compilation: CompilationEnv;

afterEach(() => {
    // Remove all compilation results from your disk
    compilation.cleanUp();
});

describe('FoobarAddon', () => {
    it('should compile', () => {
        compilation = compilationEnv("./__TEST__", { virtual: false })
                .addAddon("my-addon", join(__dirname, "../addons"))
                .addProjectFromSource({ /* your project code here */ })
                .compile();

        // expect compiled results from disk with same API as before
    });
});

```

## 2 Usage in a more complex project

You can setup your addon once and reuse it in multiple tests. The addon is compiled only once and can be used in multiple projects.

```typescript
// my-addon.test.ts
import { compilationEnv, type CompilationEnv } from '@quatico/websmith-testing';
import { join } from 'path';

let compilation: CompilationEnv;

beforeAll(() => {
    compilation = compilationEnv("./__TEST__", { virtual: false })
        .addAddon("my-addon", join(__dirname, "../addons"));
});

afterEach(() => {
    // Remove all compilation results from your disk
    compilation.cleanUp("project");
});

afterAll(() => {
    // Remove all compilation results from your disk
    compilation.cleanUp();
});

describe('MyAddon', () => {
    it('should compile project with simple component', () => {
        compilation.addProjectFromSource({ /* your project code here */ })
            .compile();

        // expect compiled results from disk with same API as before
    });
    
    it('should compile project with styled component', () => {
        compilation.addProjectFromSource({ /* your project code here */ })
            .compile();

        // expect compiled results from disk with same API as before
    });
});
```

## 3 Library API

The library provides a simple API to compile projects and addons, navigate the project and compiled files, and compare compiled file contents with expected from the filesystem, or virtual snapshots.

### 3.1 Compiler Addons

#### `addAddon(addonName: string, addonSource?: string | Record<string, string>): CompilationEnv`

Add an addon to the compilation environment. The addon is compiled before the project and can be used in the project. The `addonSource` can be a path to a folder or a set of source files. The addon is compiled every time it is added to the environment.

#### `addAddons(addonNames: string[], addonsSourceDir?: string): CompilationEnv`

Add multiple addons to the compilation environment from a file path on disk. The addons are compiled before the project and can be used in the project.

#### `getActiveAddons(): CompilerAddons`

Get the active addons in the compilation environment. The addons are stored in memory or on disk and can be accessed with the `CompilerAddons` object.

### 3.2 Project Files

#### `addProjectFromSource(source: Record<string, string>): CompilationEnv`

Add a project to the compilation environment from a set of files. The project is compiled in the order the files are added to the project. Paths can be absolute or relative to the compilation root.

#### `addProjectFromDisk(projectName: string, projectsSourceDir?: string): CompilationEnv`

Add a project to the compilation environment from a folder on disk. The project files are copied to the compilation environments build directory. Paths can be absolute or relative to the compilation root. The `projectsSourceDir` is the path to the project's source folder in the virtual or actual file system.

#### `addProjectFile(relativePath: string, content: string): CompilationEnv`

Add a single file to the project. The file is copied to the compilation environment's build directory.

#### `getProjectFiles(): ProjectFiles`

Get the project files in the compilation environment. The project files are stored in memory or on disk and can be accessed with the `ProjectFiles` object.

### 3.3 Compilation Results

#### `compile(): CompilationResults`

Compile the project and addons. The compiled files are stored in memory and can be accessed with the `CompilationResults` object.

#### `getCompiledFiles(): CompiledFiles`

Get the compiled files from the project and addons. The compiled files are stored in memory and can be accessed with the `CompiledFiles` object.

#### `getCompiledFile(path: string): CompiledFile`

Get a compiled file by its path. The compiled file is stored in memory and can be accessed with the `CompiledFile` object.

#### `cleanUp(options: "project" | "addons" | "all" = "all"): CompilationEnv`

Remove all compiled files from memory. Use `options` parameter to remove only project or addon files. This method can be called after each test to clean created files.  
