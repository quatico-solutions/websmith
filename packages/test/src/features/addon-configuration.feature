Feature: Addon configuration

    Developers can provide compiler addons by placing ES modules with an "addon.ts"
    in the addon folder, and configure via CLI arguments or config file options
    which addons are applied during compilation.

    @skip
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
        Given Folder "./addons" contains addons "foo-addon, bar-addon"
        When User calls command "websmith --addons foo-addon"
        Then Addons "foo-addon" should be applied during compilation

    @skip
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
        Given Folder "./addons" contains addons "foo-addon, bar-addon"
        When User calls command "websmith --addons foo-addon, bar-addon"
        Then Addons "foo-addon, bar-addon" should be applied during compilation

    @skip
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
        And Config file "websmith.config.json" contains "addons" with "foo-addon"
        And Folder "./addons" contains addons "foo-addon, bar-addon"
        When User calls command "websmith"
        Then Addons "foo-addon" should be applied during compilation
        And Addons "bar-addon" should not be applied