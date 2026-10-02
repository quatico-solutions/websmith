/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/**
 * Step scheduler of a watch benchmark: runs `actions` one after another, each `settle` ms after the previous step
 * ended. A step ends on the watcher's `done` or when its watchdog fires after `watchdogMs()` ms. The first `done` is
 * the initial build. Samples go to `results.initial` and `results[action.scenario]`, steps that time out are counted
 * in `results.unchanged[action.scenario]`. `finish` runs after the last step.
 *
 * Call `done(measure)` from the watcher's callback: `measure(start)` returns the sample, `start` is the `performance.now()`
 * of the step's write or undefined for the initial build.
 */
const createWatchSteps = ({ actions, results, settle, watchdogMs, finish }) => {
    let step = 0;
    let pending;
    let watchdog;

    const next = () => {
        const action = actions[step++];
        if (!action) {
            return finish();
        }
        setTimeout(() => {
            pending = { scenario: action.scenario, start: performance.now() };
            action.run();
            // A change that triggers no compilation is counted, not timed
            watchdog = setTimeout(() => {
                results.unchanged[action.scenario]++;
                pending = undefined;
                next();
            }, watchdogMs());
        }, settle);
    };

    const done = measure => {
        clearTimeout(watchdog);
        const sample = measure(pending ? pending.start : undefined);
        if (pending) {
            results[pending.scenario].push(sample);
        } else {
            results.initial = sample;
        }
        next();
    };

    return { done };
};

module.exports = { createWatchSteps };
