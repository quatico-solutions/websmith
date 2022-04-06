Feature: Compiler configuration

    Developers can provide a config (with default name "websmith.config.json") to
    configure addons and targets to be used during compilation.

    Scenario: Use CLI argument to select a custom configuration file
        # // ./my-config.json
        # {
        #     "addons": ["foo-addon"]
        # }
        Given A valid config file named "my-config.json" exists in project folder
        And Config file "my-config.json" contains "addons" with "foo-addon"
        And Folder "./addons" contains addons "foo-addon, bar-addon"
        When User calls command "websmith --config my-config.json"
        Then Addons "foo-addon" should be activated in compilation
        And Addons "bar-addon" should not be activated

