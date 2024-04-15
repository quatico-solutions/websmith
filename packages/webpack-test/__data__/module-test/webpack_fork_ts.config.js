const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const createCommonConfig = require("./webpack.common.config");

module.exports = () => {
    const commonBrowserConfig = createCommonConfig({
        targets: "noWrite",
        webpackTarget: "noWrite",
    });

    return {
        ...commonBrowserConfig,
        plugins: [new ForkTsCheckerWebpackPlugin(), ...(commonBrowserConfig.plugins ?? [])],
    };
};
