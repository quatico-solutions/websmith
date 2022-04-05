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
import ts, { factory } from "typescript";
import { getDescendantsOfKind, getFunctionName } from "./node-helpers";

export const transformInvocableArrow = (node: ts.Node, sf: ts.SourceFile, invocationFuncName = "remoteInvoke"): ts.Node => {
    if (!ts.isVariableStatement(node)) {
        return node;
    }

    // FIXME: For fully correct behavior, this should be done on a per node.declarationList.declarations to work correctly with statements that
    //          contain multiple variable statements instead of just one. This also applies to the server arrow function.
    const arrow = getDescendantsOfKind<ts.ArrowFunction>(node, ts.SyntaxKind.ArrowFunction);
    if (!arrow?.body) {
        return node;
    }

    const name = getFunctionName(node, sf);
    if (ts.isArrowFunction(arrow)) {
        const parameters = getObjectLiteralsOfNode(arrow);
        const declaration = node.declarationList.declarations[0];
        const result = factory.updateVariableStatement(
            node,
            node.modifiers,
            factory.updateVariableDeclarationList(node.declarationList, [
                factory.updateVariableDeclaration(
                    declaration,
                    declaration.name,
                    declaration.exclamationToken,
                    declaration.type,
                    factory.updateArrowFunction(
                        arrow,
                        arrow.modifiers,
                        arrow.typeParameters,
                        arrow.parameters,
                        arrow.type,
                        arrow.equalsGreaterThanToken,
                        createInvokeExpression(name, parameters, invocationFuncName)
                    )
                ),
                ...node.declarationList.declarations.slice(1),
            ])
        );

        return result;
    }
    return node;
};

export const transformLocalServerArrow = (node: ts.Node): ts.Node => {
    if (!ts.isVariableStatement(node)) {
        return node;
    }

    const arrow = getDescendantsOfKind<ts.ArrowFunction>(node, ts.SyntaxKind.ArrowFunction);
    if (!arrow) {
        return node;
    }

    if (ts.isArrowFunction(arrow)) {
        const declaration = node.declarationList.declarations[0];
        return factory.updateVariableStatement(
            node,
            node.modifiers,
            factory.updateVariableDeclarationList(node.declarationList, [
                factory.updateVariableDeclaration(
                    declaration,
                    declaration.name,
                    declaration.exclamationToken,
                    declaration.type,
                    factory.updateArrowFunction(
                        arrow,
                        arrow.modifiers,
                        arrow.typeParameters,
                        createObjectifiedParameter(arrow),
                        arrow.type,
                        arrow.equalsGreaterThanToken,
                        arrow.body
                    )
                ),
            ])
        );
    }
    return node;
};

export const transformInvocableFunction = (node: ts.Node, sf: ts.SourceFile, invocationFuncName = "remoteInvoke"): ts.Node => {
    if (!ts.isFunctionDeclaration(node) || !node.body) {
        return node;
    }

    const name = getFunctionName(node, sf);
    const parameters = getObjectLiteralsOfNode(node);
    return factory.updateFunctionDeclaration(
        node,
        node.decorators,
        node.modifiers,
        node.asteriskToken,
        node.name,
        node.typeParameters,
        node.parameters,
        node.type,
        createInvokeExpression(name, parameters, invocationFuncName)
    );
};

export const transformLocalServerFunction = (node: ts.Node): ts.Node => {
    if (!ts.isFunctionDeclaration(node)) {
        return node;
    }
    if (!node.body) {
        return node;
    }

    const newParameters = createObjectifiedParameter(node);
    return factory.updateFunctionDeclaration(
        node,
        node.decorators,
        node.modifiers,
        node.asteriskToken,
        node.name,
        node.typeParameters,
        newParameters,
        node.type,
        node.body
    );
};

/**
 * Creates an array of ts.isObjectLiteralElementLike elements based on the parameters of the function like declaration.
 * @param node The function like node from which the parameters are consumed
 * @returns Array containing one ObjectLiteralElementLike element per parameter.
 */
const getObjectLiteralsOfNode = (node: ts.Node): ts.ObjectLiteralElementLike[] | undefined => {
    if (!ts.isFunctionDeclaration(node) && !ts.isArrowFunction(node)) {
        return undefined;
    }

    const { factory } = ts;
    return node.parameters.map(par => factory.createShorthandPropertyAssignment(factory.createIdentifier(par.name.getText())));
};

/**
 * Creates an array of ts.ParameterDeclaration elements based on the parameters of the function like declaration.
 * @param node The function like node from which the parameters are consumed
 * @returns Array containing one ParameterDeclaration element per parameter.
 */
const getParameters = (node: ts.Node): ts.ParameterDeclaration[] | undefined => {
    if (!ts.isFunctionDeclaration(node) && !ts.isArrowFunction(node)) {
        return undefined;
    }

    return node.parameters.map(p => p) ?? undefined;
};

// FIXME: An already deconstructed parameter does not need objectification.
const createObjectifiedParameter = (node: ts.Node): ts.ParameterDeclaration[] => {
    const parameters = getParameters(node);
    const bindingPattern = factory.createObjectBindingPattern(
        parameters?.map(p => factory.createBindingElement(undefined, undefined, factory.createIdentifier(p.name.getText()), undefined)) ?? []
    );
    const typeLiteral = factory.createTypeLiteralNode(
        parameters?.map(p => factory.createPropertySignature(p.modifiers, p.name.getText(), p.questionToken, p.type))
    );
    return [factory.createParameterDeclaration(undefined, undefined, undefined, bindingPattern, undefined, typeLiteral, undefined)];
};

/**
 * Creates the remoteInvoke expression for a given function with the RemoteFunction<O> interface input.
 * $invocationName$({name: name, data: funcArgs })
 * @param invocationName Name of the invocation function
 * @param name Name of the function for which the remoteInvokation is created.
 * @param funcArgs The arguments passed to the function that are to be passed to the remote invocation.
 * @returns the AST representing a remoteInvoke.
 */
const createInvokeExpression = (name: string, funcArgs: ts.ObjectLiteralElementLike[] | undefined, invocationName = "remoteInvoke") => {
    return factory.createBlock(
        [
            factory.createReturnStatement(
                factory.createCallExpression(factory.createIdentifier(invocationName), undefined, [
                    factory.createObjectLiteralExpression(
                        [
                            factory.createPropertyAssignment(factory.createIdentifier("name"), factory.createStringLiteral(name)),
                            factory.createPropertyAssignment(factory.createIdentifier("data"), factory.createObjectLiteralExpression(funcArgs)),
                        ],
                        false
                    ),
                ])
            ),
        ],
        true
    );
};
