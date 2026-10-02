/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
type Action = { scenario: string; file: string; run: jest.Mock };
type Results = { initial?: unknown; edit: unknown[]; unchanged: Record<string, number>; late: Record<string, number> };
type WatchSteps = { done: (measure: (start?: number) => unknown, changedFiles?: ReadonlySet<string>) => void };
type WatchStepsOptions = { actions: Action[]; results: Results; settle: number; watchdogMs: () => number; finish: () => void };

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const { createWatchSteps } = require("../perf/watch-steps.cjs") as { createWatchSteps: (options: WatchStepsOptions) => WatchSteps };

const SETTLE = 300;
const WATCHDOG = 1000;

const createAction = (file: string): Action => ({ scenario: "edit", file, run: jest.fn() });

const createSteps = (actions: Action[]) => {
    const results: Results = { initial: undefined, edit: [], unchanged: { edit: 0 }, late: { edit: 0 } };
    const finish = jest.fn();
    const testObj = createWatchSteps({ actions, results, settle: SETTLE, watchdogMs: () => WATCHDOG, finish });
    return { testObj, results, finish };
};

const measure = (name: string) => () => ({ name });

describe("createWatchSteps", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("should record the first done as the initial build and write the first step after the settle delay", () => {
        const target = createAction("a.ts");
        const { testObj, results } = createSteps([target]);

        testObj.done(measure("initial"));
        jest.advanceTimersByTime(SETTLE);

        expect([results.initial, target.run.mock.calls.length]).toEqual([{ name: "initial" }, 1]);
    });

    it("should record one sample and count nothing as unchanged when done arrives before the watchdog", () => {
        const { testObj, results } = createSteps([createAction("a.ts")]);
        testObj.done(measure("initial"));
        jest.advanceTimersByTime(SETTLE);

        testObj.done(measure("a"), new Set(["a.ts"]));
        jest.advanceTimersByTime(10 * WATCHDOG);

        expect([results.edit, results.unchanged.edit, results.late.edit]).toEqual([[{ name: "a" }], 0, 0]);
    });

    it("should finish once when done arrives before the watchdog of the last step", () => {
        const { testObj, finish } = createSteps([createAction("a.ts")]);
        testObj.done(measure("initial"));
        jest.advanceTimersByTime(SETTLE);

        testObj.done(measure("a"), new Set(["a.ts"]));
        jest.advanceTimersByTime(10 * WATCHDOG);

        expect(finish).toHaveBeenCalledTimes(1);
    });

    it("should count a step as unchanged when its watchdog fires", () => {
        const { testObj, results } = createSteps([createAction("a.ts")]);
        testObj.done(measure("initial"));

        jest.advanceTimersByTime(SETTLE + WATCHDOG);

        expect([results.edit, results.unchanged.edit]).toEqual([[], 1]);
    });

    it("should run the next step once when a late done follows a timed-out step", () => {
        const actions = [createAction("a.ts"), createAction("b.ts"), createAction("c.ts")];
        const { testObj } = createSteps(actions);
        testObj.done(measure("initial"));
        jest.advanceTimersByTime(SETTLE + WATCHDOG);

        testObj.done(measure("late a"), new Set(["a.ts"]));
        jest.advanceTimersByTime(SETTLE);

        expect(actions.map(cur => cur.run.mock.calls.length)).toEqual([1, 1, 0]);
    });

    it("should record no sample and count the late done when a late done follows a timed-out step", () => {
        const { testObj, results } = createSteps([createAction("a.ts"), createAction("b.ts")]);
        testObj.done(measure("initial"));
        jest.advanceTimersByTime(SETTLE + WATCHDOG);

        testObj.done(measure("late a"), new Set(["a.ts"]));

        expect([results.edit, results.unchanged.edit, results.late.edit]).toEqual([[], 1, 1]);
    });

    it("should keep the initial build when a late done follows a timed-out step", () => {
        const { testObj, results } = createSteps([createAction("a.ts"), createAction("b.ts")]);
        testObj.done(measure("initial"));
        jest.advanceTimersByTime(SETTLE + WATCHDOG);

        testObj.done(measure("late a"), new Set(["a.ts"]));

        expect(results.initial).toEqual({ name: "initial" });
    });

    it("should fire the next step's watchdog when a late done arrives before that step's write", () => {
        const { testObj, results, finish } = createSteps([createAction("a.ts"), createAction("b.ts")]);
        testObj.done(measure("initial"));
        jest.advanceTimersByTime(SETTLE + WATCHDOG);

        testObj.done(measure("late a"), new Set(["a.ts"]));
        jest.advanceTimersByTime(SETTLE + WATCHDOG);

        expect([results.edit, results.unchanged.edit, finish.mock.calls.length]).toEqual([[], 2, 1]);
    });

    it("should fire the next step's watchdog when a late done without that step's file arrives after its write", () => {
        const { testObj, results } = createSteps([createAction("a.ts"), createAction("b.ts")]);
        testObj.done(measure("initial"));
        jest.advanceTimersByTime(SETTLE + WATCHDOG + SETTLE);

        testObj.done(measure("late a"), new Set(["a.ts"]));
        jest.advanceTimersByTime(WATCHDOG);

        expect([results.edit, results.unchanged.edit, results.late.edit]).toEqual([[], 2, 1]);
    });

    it("should record the next step's own done after a late done without that step's file", () => {
        const { testObj, results } = createSteps([createAction("a.ts"), createAction("b.ts")]);
        testObj.done(measure("initial"));
        jest.advanceTimersByTime(SETTLE + WATCHDOG + SETTLE);
        testObj.done(measure("late a"), new Set(["a.ts"]));

        testObj.done(measure("b"), new Set(["b.ts"]));

        expect([results.edit, results.unchanged.edit, results.late.edit]).toEqual([[{ name: "b" }], 1, 1]);
    });

    it("should finish once when a late done follows the timed-out last step", () => {
        const { testObj, finish } = createSteps([createAction("a.ts")]);
        testObj.done(measure("initial"));
        jest.advanceTimersByTime(SETTLE + WATCHDOG);

        testObj.done(measure("late a"), new Set(["a.ts"]));
        jest.advanceTimersByTime(10 * WATCHDOG);

        expect(finish).toHaveBeenCalledTimes(1);
    });
});
