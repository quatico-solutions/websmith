/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/**
 * Step scheduler of a watch benchmark: runs `actions` one after another, each `settle` ms after the previous step
 * ended. A step ends on the watcher's `done` or when its watchdog fires after `watchdogMs()` ms, whichever comes first.
 * The first `done` is the initial build. Samples go to `results.initial` and `results[action.scenario]`, steps that time
 * out are counted in `results.unchanged[action.scenario]`. `finish` runs once, after the last step.
 *
 * Call `done(measure, startedGeneration)` from the watcher's callback: `measure(start)` returns the sample, `start` is the
 * `performance.now()` of the step's write or undefined for the initial build. `startedGeneration` is `generation()` as
 * read when the rebuild started, e.g. in webpack's `watchRun` hook.
 *
 * Every step write and every step end advances the generation, and a `done` is credited only to the step whose write
 * carries the generation the rebuild started with. A `done` of a rebuild that started before the step's write or after
 * its end, e.g. a rebuild slower than the watchdog, is late: it is counted in `results.late[scenario]` of the step it
 * belongs to if that scenario has an entry in `results.late`, records nothing and starts no step. This holds for steps
 * writing the same file too, such as the flips of package.json, because the rebuild's start is compared, not its files.
 */
const createWatchSteps = ({ actions, results, settle, watchdogMs, finish }) => {
    let index = 0;
    let generation = 0;
    // The step waiting for its rebuild, undefined between steps. The initial build is the first, without an action.
    let current = { generation };
    let previous = "initial";
    let watchdog;

    const end = () => {
        generation++;
        previous = current.action ? current.action.scenario : "initial";
        current = undefined;
        clearTimeout(watchdog);
        next();
    };

    const next = () => {
        const action = actions[index++];
        if (!action) {
            return finish();
        }
        setTimeout(() => {
            current = { generation: ++generation, action, start: performance.now() };
            action.run();
            // A change that triggers no compilation is counted, not timed
            const own = current.generation;
            watchdog = setTimeout(() => {
                if (current && current.generation === own) {
                    results.unchanged[action.scenario]++;
                    end();
                }
            }, watchdogMs());
        }, settle);
    };

    const done = (measure, startedGeneration) => {
        if (!current || current.generation !== startedGeneration) {
            if (previous in results.late) {
                results.late[previous]++;
            }
            return;
        }
        const sample = measure(current.start);
        if (current.action) {
            results[current.action.scenario].push(sample);
        } else {
            results.initial = sample;
        }
        end();
    };

    return { done, generation: () => generation };
};

module.exports = { createWatchSteps };
