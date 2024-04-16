const { join } = require("path");
const createCommonConfig = require("./webpack.common.config");

module.exports = () => {
    const commonBrowserConfig = createCommonConfig({
        config: join(__dirname, "websmith_notargets.config.json"),
    });

    return {
        ...commonBrowserConfig,
    };
};
