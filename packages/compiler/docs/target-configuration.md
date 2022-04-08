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
# Custom compilation targets

websmith supports custom compilation targets. A compilation target is a name that configures which addons and additional configuration to apply to a specific compilation target. Add a `websmith.config.json` file next to your `tsconfig.json` and add a `targets` section to it. Name each target and specify the addons and configuration to apply for that target.

```json
// websmith.config.json
{
    "targets": {
        "one": {
            "addons": ["addon-foo", "addon-bar"],
            "writeFile": false,
        },
        "two": {
            "addons": ["addon-zip"],
        }
    }
}
```

Run websmith with the CLI argument `--targets` to select a specific target.

```bash
# Assumes that the configuration above is present in ./websmith.config.json
websmith --targets "one"
```