# websmith-api

Write custom addons to enrich and expand your websmith powered TypeScript compilation and bundling.

## Getting started

### Installation

Install the websmith api package using npm:

```sh
npm i -D @quatico/websmith-api
```

### Create an addon

websmith addons expect a named folder containing a module `addon` with an activate function implementing the `AddonActivator` interface.

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
