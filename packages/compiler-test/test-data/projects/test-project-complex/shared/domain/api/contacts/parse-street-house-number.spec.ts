import { parseStreetWithHouseNumber } from "./parse-street-house-number";

describe("parseStreetWithHouseNumber", () => {
    describe("basic address parsing", () => {
        it("should parse simple street with number", () => {
            const actual = parseStreetWithHouseNumber("Hauptstrasse 1");
            const expected = { street: "Hauptstrasse", houseNumber: "1" };
            expect(actual).toEqual(expected);
        });

        it("should parse street with multi-word name and number", () => {
            const actual = parseStreetWithHouseNumber("Haupt Strasse 1");
            const expected = { street: "Haupt Strasse", houseNumber: "1" };
            expect(actual).toEqual(expected);
        });

        it("should parse street with large house number", () => {
            const actual = parseStreetWithHouseNumber("Musterstrasse 123");
            const expected = { street: "Musterstrasse", houseNumber: "123" };
            expect(actual).toEqual(expected);
        });
    });

    describe("house numbers with letters", () => {
        it("should parse house number with letter suffix", () => {
            const actual = parseStreetWithHouseNumber("Bahnhofstrasse 1a");
            const expected = { street: "Bahnhofstrasse", houseNumber: "1a" };
            expect(actual).toEqual(expected);
        });

        it("should parse house number with letter suffix and multiple digits", () => {
            const actual = parseStreetWithHouseNumber("Musterstrasse 123b");
            const expected = { street: "Musterstrasse", houseNumber: "123b" };
            expect(actual).toEqual(expected);
        });

        it("should parse house number with uppercase letter", () => {
            const actual = parseStreetWithHouseNumber("Teststrasse 5A");
            const expected = { street: "Teststrasse", houseNumber: "5A" };
            expect(actual).toEqual(expected);
        });
    });

    describe("edge cases", () => {
        it("should handle street without house number", () => {
            const actual = parseStreetWithHouseNumber("Bahnhofstrasse");
            const expected = { street: "Bahnhofstrasse", houseNumber: undefined };
            expect(actual).toEqual(expected);
        });

        it("should handle empty string", () => {
            const actual = parseStreetWithHouseNumber("");
            const expected = { street: "", houseNumber: undefined };
            expect(actual).toEqual(expected);
        });

        it("should handle whitespace only", () => {
            const actual = parseStreetWithHouseNumber("   ");
            const expected = { street: "", houseNumber: undefined };
            expect(actual).toEqual(expected);
        });

        it("should handle leading and trailing whitespace", () => {
            const actual = parseStreetWithHouseNumber("  Hauptstrasse 1  ");
            const expected = { street: "Hauptstrasse", houseNumber: "1" };
            expect(actual).toEqual(expected);
        });
    });

    describe("complex street names", () => {
        it("should parse street with multiple words and number", () => {
            const actual = parseStreetWithHouseNumber("Von der Heydt Strasse 15");
            const expected = { street: "Von der Heydt Strasse", houseNumber: "15" };
            expect(actual).toEqual(expected);
        });

        it("should parse street with special characters", () => {
            const actual = parseStreetWithHouseNumber("Rue de la Paix 42");
            const expected = { street: "Rue de la Paix", houseNumber: "42" };
            expect(actual).toEqual(expected);
        });

        it("should parse street with numbers in name", () => {
            const actual = parseStreetWithHouseNumber("1st Avenue 100");
            const expected = { street: "1st Avenue", houseNumber: "100" };
            expect(actual).toEqual(expected);
        });
    });

    describe("Swiss address formats", () => {
        it("should parse typical Swiss street format", () => {
            const actual = parseStreetWithHouseNumber("Bahnhofstrasse 1");
            const expected = { street: "Bahnhofstrasse", houseNumber: "1" };
            expect(actual).toEqual(expected);
        });

        it("should parse Swiss street with apartment number", () => {
            const actual = parseStreetWithHouseNumber("Musterstrasse 123a");
            const expected = { street: "Musterstrasse", houseNumber: "123a" };
            expect(actual).toEqual(expected);
        });

        it("should parse street with umlauts", () => {
            const actual = parseStreetWithHouseNumber("Müllerstrasse 5");
            const expected = { street: "Müllerstrasse", houseNumber: "5" };
            expect(actual).toEqual(expected);
        });
    });
});
