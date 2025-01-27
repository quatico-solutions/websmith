/* eslint-disable no-console */
import { tsLibMocks } from "./packages/testing/src/tsLibMocks";

tsLibMocks();

export const removeStatComments = () => ({
    test(val: unknown): boolean {
        return !!val && typeof val === "string" && (val.includes("\\**") || val.includes("!**"));
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serialize(val: any): string {
        return val
            .split("\n")
            .filter((line: string) => !line.includes("\\**") && !line.includes("!**"))
            .join("\n");
    },
});

expect.addSnapshotSerializer(removeStatComments());
