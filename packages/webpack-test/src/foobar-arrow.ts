// @annotated()
export const getFoobar = (date: Date) => {
    return foobar(date);
};

const foobar = (date: Date) => {
    return `foobar ${date.toISOString()}`;
};
