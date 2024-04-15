const createCommonConfig = require("./webpack.common.config");

module.exports = () => {
    const commonBrowserConfig = createCommonConfig({
        targets: "noWrite,noWrite2",
        webpackTarget: "noWrite",
    });

    return {
        ...commonBrowserConfig,
    };
};
