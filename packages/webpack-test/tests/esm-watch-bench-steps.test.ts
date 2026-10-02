/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
type Action = { scenario: string; run: jest.Mock };
type Results = { initial?: unknown; edit: unknown[]; flip: unknown[]; unchanged: Record<string, number>; late: Record<string, number> };
type WatchSteps = { done: (measure: (start?: number) => unknown, startedGeneration: number) => void; generation: () => number };
type WatchStepsOptions = { actions: Action[]; results: Results; settle: number; watchdogMs: () => number; finish: () => void };

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const { createWatchSteps } = require("../perf/watch-steps.cjs") as { createWatchSteps: (options: WatchStepsOptions) => WatchSteps };

const SETTLE = 300;
const WATCHDOG = 1000;

const createAction = (scenario = "edit"): Action => ({ scenario, run: jest.fn() });

const createSteps = (actions: Action[]) => {
    const results: Results = { initial: undefined, edit: [], flip: [], unchanged: { edit: 0, flip: 0 }, late: { edit: 0, flip: 0 } };
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
        const target = createAction();
        const { testObj, results } = createSteps([target]);

        testObj.done(measure("initial"), testObj.generation());
        jest.advanceTimersByTime(SETTLE);

        const actual = [results.initial, target.run.mock.calls.length];

        expect(actual).toEqual([{ name: "initial" }, 1]);
    });

    it("should record one sample and count nothing as unchanged when done arrives before the watchdog", () => {
        const { testObj, results } = createSteps([createAction()]);
        testObj.done(measure("initial"), testObj.generation());
        jest.advanceTimersByTime(SETTLE);

        testObj.done(measure("a"), testObj.generation());
        jest.advanceTimersByTime(10 * WATCHDOG);

        const actual = [results.edit, results.unchanged.edit, results.late.edit];

        expect(actual).toEqual([[{ name: "a" }], 0, 0]);
    });

    it("should finish once when done arrives before the watchdog of the last step", () => {
        const { testObj, finish } = createSteps([createAction()]);
        testObj.done(measure("initial"), testObj.generation());
        jest.advanceTimersByTime(SETTLE);

        testObj.done(measure("a"), testObj.generation());
        jest.advanceTimersByTime(10 * WATCHDOG);

        const actual = finish;

        expect(actual).toHaveBeenCalledTimes(1);
    });

    it("should count a step as unchanged when its watchdog fires", () => {
        const { testObj, results } = createSteps([createAction()]);
        testObj.done(measure("initial"), testObj.generation());

        jest.advanceTimersByTime(SETTLE + WATCHDOG);

        const actual = [results.edit, results.unchanged.edit];

        expect(actual).toEqual([[], 1]);
    });

    it("should run the next step once when a late done follows a timed-out step", () => {
        const actions = [createAction(), createAction(), createAction()];
        const { testObj } = createSteps(actions);
        testObj.done(measure("initial"), testObj.generation());
        jest.advanceTimersByTime(SETTLE);
        const started = testObj.generation();
        jest.advanceTimersByTime(WATCHDOG);

        testObj.done(measure("late a"), started);
        jest.advanceTimersByTime(SETTLE);

        const actual = actions.map(cur => cur.run.mock.calls.length);

        expect(actual).toEqual([1, 1, 0]);
    });

    it("should record no sample and count the late done when a late done follows a timed-out step", () => {
        const { testObj, results } = createSteps([createAction(), createAction()]);
        testObj.done(measure("initial"), testObj.generation());
        jest.advanceTimersByTime(SETTLE);
        const started = testObj.generation();
        jest.advanceTimersByTime(WATCHDOG);

        testObj.done(measure("late a"), started);

        const actual = [results.edit, results.unchanged.edit, results.late.edit];

        expect(actual).toEqual([[], 1, 1]);
    });

    it("should keep the initial build when a late done follows a timed-out step", () => {
        const { testObj, results } = createSteps([createAction(), createAction()]);
        testObj.done(measure("initial"), testObj.generation());
        jest.advanceTimersByTime(SETTLE);
        const started = testObj.generation();
        jest.advanceTimersByTime(WATCHDOG);

        testObj.done(measure("late a"), started);

        const actual = results.initial;

        expect(actual).toEqual({ name: "initial" });
    });

    it("should fire the next step's watchdog when a late done arrives before that step's write", () => {
        const { testObj, results, finish } = createSteps([createAction(), createAction()]);
        testObj.done(measure("initial"), testObj.generation());
        jest.advanceTimersByTime(SETTLE);
        const started = testObj.generation();
        jest.advanceTimersByTime(WATCHDOG);

        testObj.done(measure("late a"), started);
        jest.advanceTimersByTime(SETTLE + WATCHDOG);

        const actual = [results.edit, results.unchanged.edit, finish.mock.calls.length];

        expect(actual).toEqual([[], 2, 1]);
    });

    it("should fire the next step's watchdog when a late done arrives after that step's write", () => {
        const { testObj, results } = createSteps([createAction(), createAction()]);
        testObj.done(measure("initial"), testObj.generation());
        jest.advanceTimersByTime(SETTLE);
        const started = testObj.generation();
        jest.advanceTimersByTime(WATCHDOG + SETTLE);

        testObj.done(measure("late a"), started);
        jest.advanceTimersByTime(WATCHDOG);

        const actual = [results.edit, results.unchanged.edit, results.late.edit];

        expect(actual).toEqual([[], 2, 1]);
    });

    it("should record the next step's own done after a late done that arrives after that step's write", () => {
        const { testObj, results } = createSteps([createAction(), createAction()]);
        testObj.done(measure("initial"), testObj.generation());
        jest.advanceTimersByTime(SETTLE);
        const started = testObj.generation();
        jest.advanceTimersByTime(WATCHDOG + SETTLE);
        testObj.done(measure("late a"), started);

        testObj.done(measure("b"), testObj.generation());

        const actual = [results.edit, results.unchanged.edit, results.late.edit];

        expect(actual).toEqual([[{ name: "b" }], 1, 1]);
    });

    it("should not credit a late done to the next step when both steps write the same file", () => {
        const { testObj, results } = createSteps([createAction("flip"), createAction("flip")]);
        testObj.done(measure("initial"), testObj.generation());
        jest.advanceTimersByTime(SETTLE);
        const started = testObj.generation();
        jest.advanceTimersByTime(WATCHDOG + SETTLE);

        testObj.done(measure("late flip1"), started);

        const actual = [results.flip, results.unchanged.flip, results.late.flip];

        expect(actual).toEqual([[], 1, 1]);
    });

    it("should not credit a done of a rebuild that started before the step's write", () => {
        const { testObj, results } = createSteps([createAction()]);
        testObj.done(measure("initial"), testObj.generation());
        const started = testObj.generation();
        jest.advanceTimersByTime(SETTLE);

        testObj.done(measure("early"), started);

        const actual = [results.edit, results.late.edit];

        expect(actual).toEqual([[], 0]);
    });

    it("should count no late entry for a spurious done between the initial build and the first write", () => {
        const { testObj, results } = createSteps([createAction()]);
        testObj.done(measure("initial"), testObj.generation());

        testObj.done(measure("spurious"), testObj.generation());

        const actual = results.late;

        expect(actual).toEqual({ edit: 0, flip: 0 });
    });

    it("should finish once when a late done follows the timed-out last step", () => {
        const { testObj, finish } = createSteps([createAction()]);
        testObj.done(measure("initial"), testObj.generation());
        jest.advanceTimersByTime(SETTLE);
        const started = testObj.generation();
        jest.advanceTimersByTime(WATCHDOG);

        testObj.done(measure("late a"), started);
        jest.advanceTimersByTime(10 * WATCHDOG);

        const actual = finish;

        expect(actual).toHaveBeenCalledTimes(1);
    });
});
