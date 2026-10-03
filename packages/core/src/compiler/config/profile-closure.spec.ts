/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { getProfileClosure } from "./profile-closure";

describe("getProfileClosure", () => {
    it("returns empty closure w/o profile name", () => {
        const config = { profiles: { a: {} } };

        const actual = getProfileClosure(undefined, config, "dependencies-first");

        expect(actual).toEqual({ profiles: [], missing: [] });
    });

    it("returns empty closure w/o config", () => {
        const actual = getProfileClosure("a", undefined, "dependencies-first");

        expect(actual).toEqual({ profiles: [], missing: [] });
    });

    it("returns empty closure w/ unknown target profile", () => {
        const config = { profiles: { a: { depends: ["b"] }, b: {} } };

        const actual = getProfileClosure("unknown", config, "dependencies-first");

        expect(actual).toEqual({ profiles: [], missing: [] });
    });

    it("returns target w/o depends", () => {
        const config = { profiles: { a: {} } };

        const actual = getProfileClosure("a", config, "dependencies-first");

        expect(actual).toEqual({ profiles: ["a"], missing: [] });
    });

    it("returns dependencies before target w/ dependencies-first and three-level chain", () => {
        const config = { profiles: { a: { depends: ["b"] }, b: { depends: ["c"] }, c: { depends: ["d"] }, d: {} } };

        const actual = getProfileClosure("a", config, "dependencies-first");

        expect(actual).toEqual({ profiles: ["d", "c", "b", "a"], missing: [] });
    });

    it("returns target before dependencies w/ dependents-first and three-level chain", () => {
        const config = { profiles: { a: { depends: ["b"] }, b: { depends: ["c"] }, c: { depends: ["d"] }, d: {} } };

        const actual = getProfileClosure("a", config, "dependents-first");

        expect(actual).toEqual({ profiles: ["a", "b", "c", "d"], missing: [] });
    });

    it("returns shared dependency once w/ dependencies-first and diamond", () => {
        const config = { profiles: { a: { depends: ["b", "c"] }, b: { depends: ["d"] }, c: { depends: ["d"] }, d: {} } };

        const actual = getProfileClosure("a", config, "dependencies-first");

        expect(actual).toEqual({ profiles: ["d", "b", "c", "a"], missing: [] });
    });

    it("returns shared dependency once w/ dependents-first and diamond", () => {
        const config = { profiles: { a: { depends: ["b", "c"] }, b: { depends: ["d"] }, c: { depends: ["d"] }, d: {} } };

        const actual = getProfileClosure("a", config, "dependents-first");

        expect(actual).toEqual({ profiles: ["a", "b", "d", "c"], missing: [] });
    });

    it("stops w/ dependencies-first and depends cycle", () => {
        const config = { profiles: { a: { depends: ["b"] }, b: { depends: ["a"] } } };

        const actual = getProfileClosure("a", config, "dependencies-first");

        expect(actual).toEqual({ profiles: ["b", "a"], missing: [] });
    });

    it("stops w/ dependents-first and depends cycle", () => {
        const config = { profiles: { a: { depends: ["b"] }, b: { depends: ["a"] } } };

        const actual = getProfileClosure("a", config, "dependents-first");

        expect(actual).toEqual({ profiles: ["a", "b"], missing: [] });
    });

    it("returns target once w/ self-dependency", () => {
        const config = { profiles: { a: { depends: ["a"] } } };

        const actual = getProfileClosure("a", config, "dependencies-first");

        expect(actual).toEqual({ profiles: ["a"], missing: [] });
    });

    it("returns missing depends targets in walk order w/ missing targets", () => {
        const config = { profiles: { a: { depends: ["x", "b"] }, b: { depends: ["y", "x"] } } };

        const actual = getProfileClosure("a", config, "dependencies-first");

        expect(actual).toEqual({ profiles: ["b", "a"], missing: ["x", "y"] });
    });
});
