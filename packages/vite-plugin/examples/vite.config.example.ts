// Example vite.config.ts
import { defineConfig } from "vite";
import { websmithPlugin } from "@quatico/websmith-vite-plugin";

export default defineConfig({
    plugins: [
        websmithPlugin({
            profile: "development",
            transpileOnly: true,
            configFile: "./websmith.config.json",
        }),
    ],
    build: {
        sourcemap: true,
    },
});
