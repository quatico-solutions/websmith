/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
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
