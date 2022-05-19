Feature: Target configuration

    Developers can configure different compilation targets using the
    compiler config file, e.g., "websmith.config.json". For every named
    target active addons and target specific options can be provided.

    Scenario: Provide custom configuration input to your addon
        Given A valid config file named "websmith.config.json" exists in project folder
        And Folder "./addons" contains addon examples "foobar-replace-transformer"
        And Config file "websmith.config.json" contains target "foobar"
        And Target project contains a module "target.ts" with a function is named "foobar"
        When User calls command "websmith --targets foobar"
        Then A file "./dist/target.js" exists containing string "barfoo"
        And Every call to function "foobar" in "./src/target.ts" should be replaced with "barfoo" in "./dist/target.js"
