// @annotated()
export function getFoobar(date: Date) {
    return foobar(date);
}

function foobar(date: Date) {
    return `foobar ${date.toISOString()}`;
}
