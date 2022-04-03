import { StepDefinitions } from "jest-cucumber";

export const cliSteps: StepDefinitions = ({ given, when, then }) => {
    given(/^A valid config file named "(.*)" exists in project folder$/, configPath => {});
    given(/^Config file "(.*)" contains "(.*)" with "(.*)"$/, (configPath, cfgProp, cfgValue) => {});
    given(/^Folder "(.*)" contains addons "(.*)"$/, (addonsDir, addonNames) => {});
    given(/^Config file "(.*)" contains target "(.*)"$/, (configPath, targetName) => {});
    given(/^Target project contains a module "(.*)" with a function is named "(.*)"$/, (moduleName, funcName) => {});

    when(/^User calls command "(.*)"$/, cliCommand => {});

    then(/^Addons "(.*)" should be applied during compilation$/, addonName => {});
    then(/^Addons "(.*)" should not be applied$/, addonName => {});
    then(/^Output file "(.*)" should contain a function named "(.*)"$/, (outFileName, funcName) => {});
    then(/^Every call to function "(.*)" should be replaced with "(.*)"$/, (oldFuncName, newFuncName) => {});
    then("A YAML file is emitted containing names of all exported module members", () => {});
};
