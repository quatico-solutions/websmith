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
 * Call `done(measure, changedFiles)` from the watcher's callback: `measure(start)` returns the sample, `start` is the
 * `performance.now()` of the step's write or undefined for the initial build. `changedFiles` are the files that
 * triggered the rebuild, e.g. webpack's `compiler.modifiedFiles`.
 *
 * Each step gets a generation, and only the first of its watchdog and `done` ends it and advances the generation. A
 * `done` that arrives after its step ended, e.g. a rebuild slower than the watchdog, is late: it is counted in
 * `results.late[scenario]` of the step it belongs to, records nothing and starts no step. A late `done` that arrives
 * after the next step's write is told apart from that step's own `done` by `action.file`: a rebuild whose
 * `changedFiles` lack the file is late. Without `action.file` or `changedFiles` such a rebuild is credited to the step.
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
        const own = generation;
        setTimeout(() => {
            current = { generation: own, action, start: performance.now() };
            action.run();
            // A change that triggers no compilation is counted, not timed
            watchdog = setTimeout(() => {
                if (current && current.generation === own) {
                    results.unchanged[action.scenario]++;
                    end();
                }
            }, watchdogMs());
        }, settle);
    };

    const done = (measure, changedFiles) => {
        const file = current && current.action && current.action.file;
        if (!current || (file && changedFiles && !changedFiles.has(file))) {
            results.late[previous] = (results.late[previous] || 0) + 1;
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

    return { done };
};

module.exports = { createWatchSteps };
