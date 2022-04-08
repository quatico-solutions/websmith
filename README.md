<!--
 @license

 Copyright (c) 2017-2022 Quatico Solutions AG
 Förrlibuckstrasse 220, 8005 Zurich, Switzerland

 All Rights Reserved.

 This software is the confidential and proprietary information of
 Quatico Solutions AG, ("Confidential Information"). You shall not
 disclose such Confidential Information and shall use it only in
 accordance with the terms of the license agreement you entered into
 with Quatico.
-->
# Websmith

Addon based TypeScript compiler frontend

## Getting started

1. Install the packages
To install Websmith, execute the following command in your command line environment.

```bash
# NPM
npm install typescript @websmith/compiler @websmith/cli @websmith/addon-api --save-dev

# YARN
yarn add typescript @websmith/compiler @websmith/cli @websmith/addon-api --dev
```

2. Update your package.json

 ```json
 {
     ...
     "scripts":{
         ...
         "build": "websmith",
         ...
     },
     ...
 }
 ```

3. Build your project

```bash
# NPM
npm run build

# YARN
yarn build
```

## Configure

- [ ] Write documentation for single target configuration
- [Configuration of custom compilation targets](./packages/compiler/docs/target-configuration.md)

## Creating addons

- [Custom Addons explained](./packages/compiler/docs/custom-addons.md)
- [Write your own addons](./packages/compiler/docs/write-your-own-addon.md)
