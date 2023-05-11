# websmith-api

The websmith API package provides interfaces and functionality to implement custom **addons** for the websmith compiler.

Visit the [websmith github repository](https://github.com/quatico-solutions/websmith) for more information and examples.

## Getting started

### Installation

Install the `websmith-api` package using npm:

```sh
npm i -D @quatico/websmith-api
```

### Create an addon

websmith addons are located by default within the `addons` folder. Add a named folder using your addon name, e.g., `addon-foo` and place within this folder an ES module called `addon.ts` with an activate function implementing the `AddonActivator` interface.

```typescript
// ./addons/addon-foo/addon.ts
import type { AddonContext, AddonActivator } from "@quatico/websmith-api";
import { readFileSync, writeFileSync } from "fs";

type FooConfig = {
    apiCollectionPath: string;
};

export const activate: AddonActivator = (ctx: AddonContext) => {
    // Use one of the register methods to add a generator, processor or transformer to the compilation process.
    ctx.registerGenerator((fileName: string, content: string): void => {
        const { apiCollectionPath } = ctx.getTargetConfig() as FooConfig;
        // Collect all TypeScript files containing foo in their filename
        if (/\/.*foo.*\\.ts$/.test(fileName)) {
            writeFileSync(apiCollectionPath, readFileSync(apiCollectionPath).toString() + `\n- ${fileName}`);
        }
    });
};
```

### Integrate the addon in the websmith configuration

Register your addon by adding a config file `websmith.config.json` to your project folder. Add a `targets` definition for your project with an `addons` property mentioning your addon:

```json
// websmith.config.json
{
    "targets": {
        "*": {
            "addons": ["addon-foo"],
            "writeFile": true,
            "config": {
                "apiCollectionPath": "./foo-functions.yml"
            }
        }
    }
}
```

For more information, visit the extensive [Write your own addon](../../docs/write-your-own-addon.md) documentation.
