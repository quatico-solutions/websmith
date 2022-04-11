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
// tslint:disable: max-line-length
import { Node, parseStyles, visitNode, writeNode } from "./parse-scss";

describe("parseStyles", () => {
    it("returns node of type 'stylesheet' w/ valid stylesheet", () => {
        const actual = parseStyles(".one { display: none; }");

        expect(actual.type).toBe("stylesheet");
        expect(actual.value.length).toBe(1);
    });

    it("returns node of type 'stylesheet' with empty string", () => {
        const actual = parseStyles("");

        expect(actual.type).toBe("stylesheet");
        expect(actual.value.length).toBe(0);
    });

    it("returns node of type 'stylesheet' with invalid CSS string", () => {
        const actual = parseStyles("invalid");

        expect(actual.type).toBe("stylesheet");
        expect((actual.value[0] as Node).value).toBe("invalid");
    });
});

describe("writeNode", () => {
    it("returns stylesheet string w/ valid stylesheet", () => {
        const actual = writeNode(parseStyles(".one { display: none; }"));

        expect(actual).toBe(".one { display: none; }");
    });

    it("returns stylesheet string w/ empty string", () => {
        const actual = writeNode(parseStyles(""));

        expect(actual).toBe("");
    });

    it("returns stylesheet string w/ invalid CSS string", () => {
        const actual = writeNode(parseStyles("invalid"));

        expect(actual).toBe("invalid");
    });
});

describe("visitNode", () => {
    it("calls 'visitClass' once with class styles", () => {
        const target = jest.fn();

        visitNode(parseStyles(".one { display: none; }"), { visitClass: target });

        expect(target).toHaveBeenCalledTimes(1);
    });

    it("calls 'visitIdentifier' three times with class style and property and value", () => {
        const target = jest.fn();

        visitNode(parseStyles(".one { display: none; }"), { visitIdentifier: target });

        expect(target).toHaveBeenCalledTimes(3);
    });

    it("calls 'visitIdentifier' only for class with 'endVisit' at type identifier", () => {
        const target = jest.fn().mockReturnValue(true);

        visitNode(parseStyles(".one { display: none; }"), {
            endVisit: node => node.type === "identifier",
            visitIdentifier: target,
        });

        expect(target).toHaveBeenCalledTimes(1);
        expect(target).toHaveBeenCalledWith(expect.objectContaining({ value: "one" }));
    });

    it("calls 'visitIdentifier' for class with return false", () => {
        const target = jest.fn().mockReturnValue(false);

        visitNode(parseStyles(".one { display: none; }"), {
            visitIdentifier: target,
        });

        expect(target).toHaveBeenCalledTimes(3);
    });

    it("calls 'visitIdentifier' for non-class identifieris with 'visitClass' return false", () => {
        const target = jest.fn().mockReturnValue(true);

        visitNode(parseStyles(".one { display: none; }"), {
            visitClass: () => false,
            visitIdentifier: target,
        });

        expect(target).toHaveBeenCalledTimes(2);
        expect(target).toHaveBeenCalledWith(expect.objectContaining({ value: "display" }));
        expect(target).toHaveBeenCalledWith(expect.objectContaining({ value: "none" }));
    });

    it("calls 'visitIdentifier' only for class with 'startVisit' at class and 'endVisit' at type identifier", () => {
        const target = jest.fn().mockReturnValue(true);

        visitNode(parseStyles(".one { display: none; }"), {
            endVisit: node => node.type === "identifier",
            startVisit: node => node.type === "class",
            visitIdentifier: target,
        });

        expect(target).toHaveBeenCalledTimes(1);
    });

    it("calls 'visitIdentifier' for multiple classes with 'startVisit' at class and 'endVisit' at type identifier", () => {
        const target = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                .one { display: none; }
                .two { display: none; }
        `),
            {
                endVisit: node => node.type === "identifier",
                startVisit: node => node.type === "class",
                visitIdentifier: target,
            }
        );

        expect(target).toHaveBeenCalledTimes(2);
    });

    it("calls visitArguments with function", () => {
        const targetArgs = jest.fn().mockReturnValue(true);
        const targetIdentifier = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                .one { display: var(--my-expected); }
            `),
            {
                visitArguments: targetArgs,
                visitIdentifier: targetIdentifier,
            }
        );

        expect(targetArgs).toHaveBeenCalledTimes(1);
        expect(targetArgs).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "arguments",
            })
        );
        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "my-expected",
            })
        );
    });

    it("calls visitProperty with property", () => {
        const targetProperty = jest.fn().mockReturnValue(true);
        const targetIdentifier = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                { display: none; }
            `),
            {
                visitIdentifier: targetIdentifier,
                visitProperty: targetProperty,
            }
        );

        expect(targetProperty).toHaveBeenCalledTimes(1);
        expect(targetProperty).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "property",
            })
        );
        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "display",
            })
        );
    });

    it("calls visitAtKeyword with @import", () => {
        const targetKeyword = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                @import "whatever";
            `),
            {
                visitAtKeyword: targetKeyword,
            }
        );

        expect(targetKeyword).toHaveBeenCalledTimes(1);
        expect(targetKeyword).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "atkeyword",
                value: "import",
            })
        );
    });

    it("calls visitAtRule with @media", () => {
        const targetRule = jest.fn().mockReturnValue(true);
        const targetKeyword = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                @media screen { }
            `),
            {
                visitAtKeyword: targetKeyword,
                visitAtRule: targetRule,
            }
        );

        expect(targetRule).toHaveBeenCalledTimes(1);
        expect(targetRule).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "atrule",
            })
        );
        expect(targetKeyword).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "atkeyword",
                value: "media",
            })
        );
    });

    it("calls visitAttribute with attribute", () => {
        const targetAttribute = jest.fn().mockReturnValue(true);
        const targetIdentifier = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                a[title] { }              
            `),
            {
                visitAttribute: targetAttribute,
                visitIdentifier: targetIdentifier,
            }
        );

        expect(targetAttribute).toHaveBeenCalledTimes(1);
        expect(targetAttribute).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "attribute",
            })
        );
        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "title",
            })
        );
    });

    it("calls visitBlock with class block", () => {
        const targetBlock = jest.fn().mockReturnValue(true);
        const targetIdentifier = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                .one { }              
            `),
            {
                visitBlock: targetBlock,
                visitIdentifier: targetIdentifier,
            }
        );

        expect(targetBlock).toHaveBeenCalledTimes(1);
        expect(targetBlock).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "block",
            })
        );
        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "one",
            })
        );
    });

    it("calls visitDeclaration with property declaration", () => {
        const targetDeclaration = jest.fn().mockReturnValue(true);
        const targetIdentifier = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                { display: none; }              
            `),
            {
                visitDeclaration: targetDeclaration,
                visitIdentifier: targetIdentifier,
            }
        );

        expect(targetDeclaration).toHaveBeenCalledTimes(1);
        expect(targetDeclaration).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "declaration",
            })
        );
        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "display",
            })
        );
    });

    it("calls visitDeclaration with custom property declaration", () => {
        const targetDeclaration = jest.fn().mockReturnValue(true);
        const targetIdentifier = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                { --my-expected: none; }              
            `),
            {
                visitDeclaration: targetDeclaration,
                visitIdentifier: targetIdentifier,
            }
        );

        expect(targetDeclaration).toHaveBeenCalledTimes(1);
        expect(targetDeclaration).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "declaration",
            })
        );
        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "my-expected",
            })
        );
    });

    it("calls visitFunction with attr function", () => {
        const targetFunction = jest.fn().mockReturnValue(true);
        const targetIdentifier = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                { content: " (" attr(href) ")"; }              
            `),
            {
                visitFunction: targetFunction,
                visitIdentifier: targetIdentifier,
            }
        );

        expect(targetFunction).toHaveBeenCalledTimes(1);
        expect(targetFunction).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "function",
            })
        );
        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "href",
            })
        );
    });

    it("calls visitId with ID selector", () => {
        const targetId = jest.fn().mockReturnValue(true);
        const targetIdentifier = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                #expected { }
            `),
            {
                visitId: targetId,
                visitIdentifier: targetIdentifier,
            }
        );

        expect(targetId).toHaveBeenCalledTimes(1);
        expect(targetId).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "id",
            })
        );
        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "expected",
            })
        );
    });

    it("visits @include and contained child nodes", () => {
        const targetIdentifier = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                @include expected;
            `),
            {
                visitIdentifier: targetIdentifier,
            }
        );

        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "expected",
            })
        );
    });

    it("visits @mixin and contained child nodes", () => {
        const targetIdentifier = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                @mixin expected { }
        `),
            {
                visitIdentifier: targetIdentifier,
            }
        );

        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "expected",
            })
        );
    });

    it("calls visitParentheses with explicit use of parentheses", () => {
        const targetParentheses = jest.fn().mockReturnValue(true);
        const targetNumber = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                @debug (1 + 2) * 3;
        `),
            {
                visitNumber: targetNumber,
                visitParentheses: targetParentheses,
            }
        );

        expect(targetParentheses).toHaveBeenCalledTimes(1);
        expect(targetNumber).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "number",
                value: "1",
            })
        );
        expect(targetNumber).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "number",
                value: "2",
            })
        );
    });

    it("does not call visitParentheses with var function", () => {
        const targetParentheses = jest.fn().mockReturnValue(true);
        visitNode(
            parseStyles(`
                .one { display: var(--my-expected); };
        `),
            {
                visitParentheses: targetParentheses,
            }
        );

        expect(targetParentheses).toHaveBeenCalledTimes(0);
    });

    it("calls visitPseudoElement with :hover selector", () => {
        const targetPseudoElement = jest.fn().mockReturnValue(true);
        const targetIdentifier = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                expected:hover { }
        `),
            {
                visitIdentifier: targetIdentifier,
                visitPseudoElement: targetPseudoElement,
            }
        );

        expect(targetPseudoElement).toHaveBeenCalledTimes(1);
        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "expected",
            })
        );
        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "hover",
            })
        );
    });

    it("calls visitPseudoElement with ::after selector", () => {
        const targetPseudoElement = jest.fn().mockReturnValue(true);
        const targetIdentifier = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                expected::after { }
        `),
            {
                visitIdentifier: targetIdentifier,
                visitPseudoElement: targetPseudoElement,
            }
        );

        expect(targetPseudoElement).toHaveBeenCalledTimes(1);
        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "expected",
            })
        );
        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "after",
            })
        );
    });

    it("calls visitRule with two class selector blocks", () => {
        const target = jest.fn().mockReturnValue(false);

        visitNode(
            parseStyles(`
                .one { display: none; }
                .two { display: none; }
        `),
            {
                visitRule: target,
            }
        );

        expect(target).toHaveBeenCalledTimes(2);
    });

    it("calls visitSelector with two class selectors", () => {
        const targetSelector = jest.fn().mockReturnValue(true);
        const targetIdentifier = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                .one, .two { }
        `),
            {
                visitIdentifier: targetIdentifier,
                visitSelector: targetSelector,
            }
        );

        expect(targetSelector).toHaveBeenCalledTimes(1);
        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "one",
            })
        );
        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "two",
            })
        );
    });

    it("calls visitSelector with two class selector rules", () => {
        const target = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                .one { }
                .two { }
        `),
            {
                visitSelector: target,
            }
        );

        expect(target).toHaveBeenCalledTimes(2);
    });

    it("calls visitValue once with one property value", () => {
        const targetValue = jest.fn().mockReturnValue(true);
        const targetIdentifier = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                {
                    .one { display: none; }
                }
        `),
            {
                visitIdentifier: targetIdentifier,
                visitValue: targetValue,
            }
        );

        expect(targetValue).toHaveBeenCalledTimes(1);
        expect(targetIdentifier).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "identifier",
                value: "none",
            })
        );
    });

    it("calls visitPunctuation twice with two punctuation symbols", () => {
        const target = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                .one { display: none; }
            `),
            {
                visitPunctuation: target,
            }
        );

        expect(target).toHaveBeenCalledTimes(2);
        expect(target).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "punctuation",
                value: ":",
            })
        );
        expect(target).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "punctuation",
                value: ";",
            })
        );
    });

    it("calls visitOperator twice with custom property", () => {
        const target = jest.fn().mockReturnValue(true);

        visitNode(
            parseStyles(`
                .one { display: var(--expected); }
            `),
            {
                visitOperator: target,
            }
        );

        expect(target).toHaveBeenCalledTimes(2);
        expect(target).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "operator",
                value: "-",
            })
        );
    });

    it("calls visitSpace twice with two spaces", () => {
        const target = jest.fn().mockReturnValue(true);

        visitNode(parseStyles(`.one { }`), {
            visitSpace: target,
        });

        expect(target).toHaveBeenCalledTimes(2);
    });
});
