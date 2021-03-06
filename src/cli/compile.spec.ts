// FIXME: Add cli test once environment is fixed
// jest.mock("../compiler", () => ({
//     Compiler: class TestCompiler {
//         public compile() {
//             return 0;
//         }
//     },
// }));
// jest.mock("./find-config");
// import { compile } from "./compile";

// // @ts-ignore
// process.stdout = jest.fn();

// beforeEach(() => {
//     jest.clearAllMocks();
// });

describe.skip("compile", () => {
    it.skip("should ", () => {
        // @ts-ignore
        process.exit = jest.fn();

        // compile([]);

        expect(process.exit).toBeCalledWith("0");
    });
});
