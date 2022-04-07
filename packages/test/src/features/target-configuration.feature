Feature: Target configuration

    Developers can configure different compilation targets using the
    compiler config file, e.g., "websmith.config.json". For every named
    target active addons and target specific options can be provided.

    @skip
    Scenario: Provide custom configuration input to your addon
        # // websmith.config.json
        # {
        #    "targets": {
        #        "foobar": {
        #            "addons": ["foobar-transformer"],
        #            "config": {
        #                "substitute": "barfoo"
        #            },
        #            "writeFile": true
        #        }
        #    }
        # }
        #
        # // ./addons/foobar-transformer/addon.ts
        # import { CompilationContext } from "@websmith/addon-api";
        #
        # export const activate = (ctx: CompilationContext<FoobarTransformerConfig>) => {
        #     const { substitute } = ctx.getTargetConfig();
        #     ctx.registerEmitTransformer({
        #         before: [createFoobarTransformer(substitute)],
        #     });
        # };
        #
        # type FoobarTransformerConfig = {
        #     substitute: string;
        # };
        #
        # const createFoobarTransformer = (substitute: string) => {
        #     // TBD put actual implementation here
        # };

        Given A valid config file named "websmit.config.json" exists in project folder
        And Folder "./addons" contains addons "foobar-transformer"
        And Config file "websmit.config.json" contains target "foobar"
        And Target project contains a module "target.ts" with a function is named "foobar"
        When User calls command "websmith --targets foobar"
        Then Output file "target.js" should contain a function named "barfoo"
        And Every call to function "foobar" should be replaced with "barfoo"

