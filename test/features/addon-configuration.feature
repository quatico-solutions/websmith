Feature: Addon configuration

    Developers can provide compiler addons by placing ES modules with an "addon.ts"
    in the addon folder, and configure via CLI arguments or config file options
    which addons are applied during compilation.

    Scenario: Use CLI argument to activate a specific addon
        # // ./addons/foo-addon/addon.ts
        # export const activate = () => {
        #     console.log('foo-addon activated');
        # };
        #
        # // ./addons/bar-addon/addon.ts
        # export const activate = () => {
        #     console.log('bar-addon activated');
        # };
        Given Folder "./addons" contains addons "foo-addon" and "bar-addon"
        When User calls command "websmith --addons foo-addon"
        Then Addon "foo-addon" is applied during compilation

    Scenario: Use CLI argument to activate multiple addons
        # // ./addons/foo-addon/addon.ts
        # export const activate = () => {
        #     console.log('foo-addon activated');
        # };
        #
        # // ./addons/bar-addon/addon.ts
        # export const activate = () => {
        #     console.log('bar-addon activated');
        # };
        Given Folder "./addons" contains addons "foo-addon" and "bar-addon"
        When User calls command "websmith --addons foo-addon, bar-addon"
        Then Addons "foo-addon" and "bar-addon" are applied during compilation

    Scenario: Use a config file to select active addons
        # // ./addons/foo-addon/addon.ts
        # export const activate = () => {
        #     console.log('foo-addon activated');
        # };
        #
        # // ./addons/bar-addon/addon.ts
        # export const activate = () => {
        #     console.log('bar-addon activated');
        # };
        #
        #  // ./websmith.config.json
        #  {
        #      "addons": ["foo-addon"]
        #  }
        Given A valid config file named "websmith.config.json" exists in project folder
        And Config file contains "addons" with "foo-addon"
        And Folder "./addons" contains addons "foo-addon" and "bar-addon"
        When User calls command "websmith"
        Then Addon "foo-addon" is applied during compilation
        And Addon "bar-addon" is not applied