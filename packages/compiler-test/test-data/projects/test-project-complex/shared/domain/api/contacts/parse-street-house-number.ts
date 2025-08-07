/**
 * Parses a street address string to extract street name and house number.
 * The last numeric part is considered the house number, everything before it is the street name.
 * Examples:
 * - "Hauptstrasse 1" -> street: "Hauptstrasse", houseNumber: "1"
 * - "Haupt Strasse 1" -> street: "Haupt Strasse", houseNumber: "1"
 * - "Musterstrasse 123a" -> street: "Musterstrasse", houseNumber: "123a"
 * - "Bahnhofstrasse" -> street: "Bahnhofstrasse", houseNumber: undefined
 */

export const parseStreetWithHouseNumber = (
    streetNumberString: string
): { street: string; houseNumber?: string } => {
    const trimmed = streetNumberString.trim();
    if (!trimmed) {
        return { street: "", houseNumber: undefined };
    }

    // Match the last part that contains numbers (house number)
    // This regex matches: numbers, numbers with letters (like 1a, 123b), or just letters after numbers
    const houseNumberMatch = trimmed.match(/(\d+[a-zA-Z]*)\s*$/);

    if (!houseNumberMatch) {
        // No house number found, entire string is street name
        return { street: trimmed, houseNumber: undefined };
    }

    const houseNumber = houseNumberMatch[1];
    const street = trimmed.substring(0, houseNumberMatch.index).trim();

    return { street, houseNumber };
};
