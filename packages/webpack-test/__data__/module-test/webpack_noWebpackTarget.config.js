const createCommonConfig = require("./webpack.common.config");

module.exports = () => {
    const commonBrowserConfig = createCommonConfig({
        targets: "noWrite",
    });

    return {
        ...commonBrowserConfig,
    };
};
