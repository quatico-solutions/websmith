Feature: Compiler configuration

    Developers can provide a config (with default name "websmith.config.json") to
    configure addons and targets to be used during compilation.

    Scenario: Use CLI argument to select a custom configuration file
        # // ./my-config.json
        # {
        #     "addons": ["foo-addon"]
        # }
        Given A valid config file named "my-config.json" exists in project folder
        And Config file contains "addons" with "foo-addon"
        And Folder "./addons" contains addons "foo-addon" and "bar-addon"
        When User calls command "websmith --config my-config.json"
        Then Addon "foo-addon" is applied during compilation
        And Addon "bar-addon" is not applied

