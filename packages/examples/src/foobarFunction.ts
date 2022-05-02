// @annotated()
export function getBarfuss(date: Date) {
    return foobar(date);
}

function foobar(date: Date) {
    return `foobar ${date.toISOString()}`;
}
