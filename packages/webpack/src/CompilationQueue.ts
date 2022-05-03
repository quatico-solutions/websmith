/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */

const STATE_INITIAL = "initial";
const STATE_DONE = "done";
const STATE_PENDING = "pending";
type ContributorState = typeof STATE_INITIAL | typeof STATE_DONE | typeof STATE_PENDING;

interface CompilationQueueContributor {
    readonly state: ContributorState;
    done: () => void;
    inProgress: () => void;
}

type CompilationQueueCallback = () => void;

class CompilationQueue {
    private contributors: CompilationQueueContributor[] = [];
    private callbacks: CompilationQueueCallback[] = [];

    public checkDone(): void {
        const pending = this.contributors.filter(c => c.state !== STATE_DONE);
        if (pending.length === 0) {
            while (this.callbacks.length) {
                this.callbacks.pop()?.();
            }
        }
    }

    public contribute(): CompilationQueueContributor {
        let state: ContributorState = STATE_INITIAL;
        const contributor = {
            done: () => {
                state = STATE_DONE;
                this.checkDone();
            },
            inProgress: () => {
                state = STATE_PENDING;
            },
            get state(): ContributorState {
                return state;
            },
        };
        this.contributors.push(contributor);
        return contributor;
    }

    public whenDone(callback: CompilationQueueCallback): void {
        this.callbacks.push(callback);
        this.checkDone();
    }
}

const defaultQueue = new CompilationQueue();
const contribute = () => defaultQueue.contribute();
const whenDone = (callback: CompilationQueueCallback) => defaultQueue.whenDone(callback);

export { CompilationQueue, CompilationQueueCallback, CompilationQueueContributor, contribute, whenDone };
