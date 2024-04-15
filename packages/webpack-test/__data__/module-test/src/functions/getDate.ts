// @service()
export const getDate = async (offsetHours: number) => new Date(new Date().getTime() + offsetHours * 60 * 60 * 1000);
