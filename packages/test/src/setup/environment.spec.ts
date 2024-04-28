import { setUp } from "./environment";
import { activeAddons } from "./expect";

describe("installAddons", () => {
    it("should install addon successfully", () => {
        const { addAddons, cleanUp, rootDir } = setUp("/", {
            virtual: true,
            files: {
                "/addons/tsconfig.json": "{}",
                "./addons/target-addon/addon.ts": `
                    export const activate = () => {};
                `,
                "./tsconfig.json": "{}",
            },
        });

        const actual = addAddons("target-addon", "../test-data/addons/");

        cleanUp(rootDir);

        expect(activeAddons(actual)).toEqual(["target-addon"]);
    });
});
