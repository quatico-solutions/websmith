// @annotated()
export const foobar = (date: Date) => {
    return `foobar ${date.toISOString()}`;
};

export const someNotAnnotatedFunction = () => {
    return "someNotAnnotatedFunction";
};
