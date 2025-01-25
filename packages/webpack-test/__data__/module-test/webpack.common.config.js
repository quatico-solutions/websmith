const { join } = require("path");

module.exports = ({
    sourceDir = join(__dirname, "src"),
    configFile = join(__dirname, "websmith.config.json"),
    preLoaders = [],
    postLoaders = [],
    targets = "noWrite",
    webpackTarget,
}) => {
    const websmithLoaderOptions = {
        project: join(__dirname, "tsconfig.json"),
        configFile,
        targets,
        ...(!!webpackTarget && { webpackTarget }),
    };

    return {
        target: "web",
        devtool: "source-map",
        mode: "development",
        entry: {
            main: join(sourceDir, "index.tsx"),
            functions: join(sourceDir, "functions", "getDate.ts"),
        },
        output: {
            path: join(__dirname, ".build/lib"),
            publicPath: "/",
        },
        resolve: {
            extensions: [".js", ".ts", ".tsx"],
        },
        module: {
            rules: [
                {
                    test: /\.[j|t]sx?$/,
                    include: [sourceDir],
                    use: [
                        ...preLoaders,
                        {
                            loader: "@quatico/websmith-webpack",
                            options: websmithLoaderOptions,
                        },
                        ...postLoaders,
                    ],
                },
            ],
        },
    };
};
