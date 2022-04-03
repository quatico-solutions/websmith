Feature: Target configuration

    Developers can configure different compilation targets using the
    compiler config file, e.g., "websmith.config.json". For every named
    target active addons and target specific options can be provided.

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
        Given A "foobar-transformer" addon is provided in the "addons" directory
        And A "foobar" target is configured in the "websmith.config.json" file
        And The target project contains a module "target.ts" with a function is named "foobar"
        When User calls the command "websmith foobar"
        Then The output file "target.js" should contain a function named "barfoo"
        And Every call to that function in the project should be replaced with "barfoo"

























"websmith -p tsconfig.json foobar"