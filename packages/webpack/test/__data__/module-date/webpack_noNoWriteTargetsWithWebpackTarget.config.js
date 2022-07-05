const createCommonConfig = require("./webpack.common.config");

module.exports = () => {
    const commonBrowserConfig = createCommonConfig({
        targets: "writeOnly",
        webpackTarget: "writeOnly",
    });

    return {
        ...commonBrowserConfig,
    };
};
