# BDD Features

## Feature: Compiler configuration

### Scenario: Use CLI argument to select a custom configuration file

```json
// ./my-config.json
{
 "addons": ["foo-addon"]
}
```

```gherkin
Given A valid config file named "my-config.json" exists in project folder
And Config file contains "addons" with "foo-addon"
And Folder "./addons" contains addons "foo-addon" and "bar-addon"
When User calls command "websmith —config my-config.json"
Then Addon "foo-addon" is applied during compilation
And Addon "bar-addon" is not applied
```

## Feature: Addon configuration

### Scenario: Use CLI argument to activate a specific addon

```gherkin
Given Folder "./addons" contains addons "foo-addon" and "bar-addon"
When User calls command "websmith —addons foo-addon"
Then Addon "foo-addon" is applied during compilation
```

### Scenario: Use CLI argument to activate multiple addons

```gherkin
Given Folder "./addons" contains addons "foo-addon" and "bar-addon"
When User calls command "websmith —addons foo-addon, bar-addon"
Then Addons "foo-addon" and "bar-addon" are applied during compilation
```

### Scenario: Use a config file to select active addons

```json
// ./websmith.config.json
{
 "addons": ["foo-addon"]
}
```

```gherkin
Given A valid config file named "websmith.config.json" exists in project folder
And Config file contains "addons" with "foo-addon"
And Folder "./addons" contains addons "foo-addon" and "bar-addon"
When User calls command "websmith"
Then Addon "foo-addon" is applied during compilation
And Addon "bar-addon" is not applied
```

## Feature: Addon contribution

### Scenario: Run Compiler with all addons in default directory

```gherkin
Given Folder "./addons" contains addons "foo-addon" and "bar-addon"
When User calls command "websmith"
Then Addons "bar-addon" and "foo-addon" are applied during compilation
```

### Scenario: Use CLI argument to select different addons directory

```gherkin
Given Folder "./my-addons" contains addons "foo-addon" and "bar-addon"
When User calls command "websmith —addonsDir ./my-addons"
Then Addons "bar-addon" and "foo-addon" are applied during compilation
```

### Scenario: Provide a generator addon in default addons directory

```javascript
// ./addons/doc-generator/addons.ts
import { CompilationContext } from "@websmith/addon-api";

/**

* Generates a YAML file with all exported module members
 */
export const activate = (ctx: CompilationContext) => {
 // TODO: Provide implementation
}
```

```gherkin
Given Folder "./addons" contains addon "doc-generator"
When User calls command "websmith"
Then Addon "doc-generator" is applied during compilation
And A YAML file is emitted containing names of all exported module members m
```

### Scenario: Provide a pre-emit transformer addon in default addons directory

### Scenario: Provide an emit transformer addon in default addons directory

## Feature: Target configuration

### Scenario: Provide custom configuration input to your addon

```json
//websmith.config.json
{
 "targets": {
  "foobar" {
   "addons": ["foobar-transformer"],
   "config": {
    "substitute": "barfoo"
   },
   "writeFile": true
  }
 }
}
```

```javascript
// ./addons/foobar-transformer/addon.ts
import { CompilationContext } from "@websmith/addon-api";

export const activate = (ctx: CompilationContext<FoobarTransformerConfig>) => {
 const { substitute } = ctx.getTargetConfig();
 ctx.registerEmitTransformer({ before: [
  createFoobarTransformer(substitute)
 ]});
};

const type FoobarTransformerConfig = {
 substitute: string;
};

const createFoobarTransformer = (substitute: string) => {
 // TBD put actual implementation here
};
```

"websmith -p tsconfig.json foobar"
