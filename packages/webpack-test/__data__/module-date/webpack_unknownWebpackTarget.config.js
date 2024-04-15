const createCommonConfig = require("./webpack.common.config");

module.exports = () => {
    const commonBrowserConfig = createCommonConfig({
        targets: "writeOnly",
        webpackTarget: "noWrite",
    });

    return {
        ...commonBrowserConfig,
    };
};
