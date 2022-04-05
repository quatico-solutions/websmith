import path from "path";

const fs = jest.requireActual("fs");

export const readE2eTestData = ({ name, dataType = "json" }: { name: string; dataType: string }): string => {
    return fs.readFileSync(path.resolve(__dirname, "__data__", dataType, `${name}.${dataType}`)).toString();
};
