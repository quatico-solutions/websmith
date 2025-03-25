import { getFoobarServer } from "./functions/server-function";

export function getFoobarClient(date: Date) {
    return getFoobarServer(date);
}
