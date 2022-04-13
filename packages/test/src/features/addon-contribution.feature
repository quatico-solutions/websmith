Feature: Feature: Addon contribution

    Developers can provide compiler addons by placing ES modules with an "addon.ts"
    in the addons folder. Every addon needs to export an "activate" function that
    receives a "AddonContext". Addons can register generator, pre-emit
    transformer or emit transformer functions.

    Scenario: Run Compiler with all addons in default directory
        Given Folder "./addons" contains addons "foo-addon, bar-addon"
        When User calls command "websmith"
        Then Addons "bar-addon, foo-addon" should be activated in compilation

    Scenario: Use CLI argument to select different addons directory
        Given Folder "./my-addons" contains addons "foo-addon, bar-addon"
        When User calls command "websmith --addonsDir ./my-addons"
        Then Addons "bar-addon, foo-addon" should be activated in compilation

    Scenario: Provide example generator addon in default addons directory
        Given Folder "./addons" contains addon examples "example-generator"
        And A test project "test-project-foo" is provided
        When User calls command "websmith"
        Then Addons "example-generator" should be activated in compilation
        And A file "./src/foo-added.ts" exists containing string "const foo = ()"

    Scenario: Provide example processor addon in default addons directory
        Given Folder "./addons" contains addon examples "example-processor"
        And A test project "test-project-foobar" is provided
        When User calls command "websmith"
        Then Addons "example-processor" should be activated in compilation
        And A file "./src/foobar.ts" exists containing string "export const foobar = ()"

    Scenario: Provide example transformer addon in default addons directory
        Given Folder "./addons" contains addon examples "example-transformer"
        And A test project "test-project-foobar" is provided
        When User calls command "websmith"
        Then Addons "example-transformer" should be activated in compilation
        And A file "./dist/foobar.js" exists containing string "const barfoo = () =>"

    Scenario: Provide example result processor addon in default addons directory
        Given Folder "./addons" contains addon examples "example-result-processor"
        And A test project "test-project-one" is provided
        When User calls command "websmith"
        Then Addons "example-result-processor" should be activated in compilation
        And A file "./dist/one.js" exists containing string "was compiled by the websmith compiler"

    Scenario: Provide a complex generator addon in default addons directory
        Given Folder "./addons" contains addon examples "export-yaml-generator"
        And A test project "test-project-one" is provided
        When User calls command "websmith"
        Then Addons "export-yaml-generator" should be activated in compilation
        And A file "./dist/output.yaml" exists containing names "one, two, three"
