Feature: Feature: Addon contribution

    Developers can provide compiler addons by placing ES modules with an "addon.ts"
    in the addons folder. Every addon needs to export an "activate" function that
    receives a "CompilationContext". Addons can register generator, pre-emit
    transformer or emit transformer functions.

    Scenario: Run Compiler with all addons in default directory
        Given Folder "./addons" contains addons "foo-addon, bar-addon"
        When User calls command "websmith"
        Then Addons "bar-addon, foo-addon" should be activated in compilation

    Scenario: Use CLI argument to select different addons directory
        Given Folder "./my-addons" contains addons "foo-addon, bar-addon"
        When User calls command "websmith --addonsDir ./my-addons"
        Then Addons "bar-addon, foo-addon" should be activated in compilation

    @skip
    Scenario: Provide a generator addon in default addons directory
        # // ./addons/doc-generator/addons.ts
        # import { CompilationContext } from "@websmith/addon-api";
        # /**
        #  * Generates a YAML file with all exported module members
        #  */
        # export const activate = (ctx: CompilationContext) => {
        #     // TODO: Provide implementation
        # };
        Given Folder "./addons" contains addons "doc-generator"
        When User calls command "websmith"
        Then Addons "doc-generator" should be activated in compilation
        And A YAML file is emitted containing names of all exported module members

    @skip
    Scenario: Provide a processor addon in default addons directory
    # TODO: Provide a scenario for a pre-emit transformer example

    @skip
    Scenario: Provide an transformer addon in default addons directory
# TODO: Provide a scenario for a emit transformer example