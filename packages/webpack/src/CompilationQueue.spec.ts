/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
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
import { CompilationQueue, CompilationQueueContributor } from "./CompilationQueue";

describe("CompilationQueue", () => {
    let testObj: CompilationQueue;
    let contributor: CompilationQueueContributor;
    const target = jest.fn();

    beforeEach(() => {
        testObj = new CompilationQueue();
        contributor = testObj.contribute();
        testObj.whenDone(target);
    });

    it("should report progress after progress in contribution", () => {
        const progressContributor = testObj.contribute();

        progressContributor.inProgress();
        contributor.done();

        expect(target).not.toHaveBeenCalled();
    });

    it("should be done after the final contribution", () => {
        contributor.done();

        expect(target).toHaveBeenCalled();
    });
});
