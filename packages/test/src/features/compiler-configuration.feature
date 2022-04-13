Feature: Compiler configuration

    Developers can provide a config (with default name "websmith.config.json") to
    configure addons and targets to be used during compilation.

    Scenario: Use CLI argument to compile a project
        Given A test project "test-project-one" is provided
        When User calls command "websmith"
        Then A file "./dist/one.js" exists containing string "const one = () =>"
        And A file "./dist/two.js" exists containing string "const two = () =>"
        And A file "./dist/three.js" exists containing string "const three = () =>"

    Scenario: Use CLI argument to select a custom configuration file
        Given A valid config file named "my-config.json" exists in project folder
        And Config file "my-config.json" contains "addons" with "foo-addon"
        And Folder "./addons" contains addons "foo-addon, bar-addon"
        When User calls command "websmith --config my-config.json"
        Then Addons "foo-addon" should be activated in compilation
        And Addons "bar-addon" should not be activated

