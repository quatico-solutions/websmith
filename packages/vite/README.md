<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->
# @quatico/websmith-vite

A custom Vite plugin to add the websmith compiler to your build process.

Visit the [websmith github repository](https://github.com/quatico-solutions/websmith) for more information and examples.

## Getting started

### Installation

Install the websmith Vite plugin using npm:

```sh
pnpm add -D @quatico/websmith-vite
```

### Add Vite configuration

Now we can use the `@quatico/websmith-vite` plugin and the websmith configuration to configure Vite.

```javascript
// vite.config.js
import { resolve } from "path";
import { defineConfig } from "vite";
import websmith from "@quatico/websmith-vite";

export default defineConfig({
    plugins: [
        websmith({
            project: resolve(__dirname, "tsconfig.json"),
            config, // Your websmith config
        }),
    ],
});
```

### Build your project

You can run Vite in one of your build targets with:

```sh
vite build
```
