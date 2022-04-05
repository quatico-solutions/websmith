# Custom compilation targets

websmith supports custom compilation targets. A compilation target is name that configures which addons and additional configuration to apply to a specific compilation target. Add a `websmith.config.json` file next to your `tsconfig.json` and add a `targets` section to it. Name each target and specify the addons and configuration to apply for that target.

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

Run websmith with the CLI argument `--target` to select a specific target.