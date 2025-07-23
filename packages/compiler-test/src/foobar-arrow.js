// @annotated()
export const getFoobar = (date) => {
    return foobar(date);
};
const foobar = (date) => {
    return `foobar ${date.toISOString()}`;
};
