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

# TODOS

- [ ] Add proper CLI interface
- [ ] Depict scope: injectStyles, generate-docs (mixins, properties), generate-snippets (scss, css), optimize CSS styles
- [ ] Picture compilation process w/ targets, transformers, plugins
- [ ] Describe API for AST Transformers

## Development

- [ ] Fix Warn / Error messages (diagnostic does not provide them in CLI mode)
- [ ] Reimplement Watch Mode (does not compile; watches files multiple times)
- [ ] Are we fine with the fact that without a `per target` configuration, the user is not able to control the `TargetConfig` as we do not have it available in the CompilationConfig for single target environments?

## Documentation

- [ ] Getting started with devDependencies etc
- [ ] CompilerConfig
- [ ] CompilationConfig
- [ ] TargetConfig and how to access it through AddonContext
