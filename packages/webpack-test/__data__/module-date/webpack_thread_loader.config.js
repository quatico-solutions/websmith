const createCommonConfig = require("./webpack.common.config");

module.exports = () => {
    const commonBrowserConfig = createCommonConfig({
        targets: "noWrite",
        webpackTarget: "noWrite",
        preLoaders: ["thread-loader"],
    });

    return {
        ...commonBrowserConfig,
    };
};
