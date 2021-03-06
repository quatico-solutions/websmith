// Allow for changes to AST nodes
// tslint:disable-next-line
Object.freeze = (obj: any) => obj;
import { Node, parse, stringify } from "scss-parser";

interface StyleVisitor {
    /**
     * Return true to disable calls to "visit" methods until "startVisit" returns true.
     */
    endVisit?: (node: Node) => boolean;
    /**
     * Return true to enable calls to "visit" method, if they where disabled before.
     */
    startVisit?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitArguments?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitAtKeyword?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitAtRule?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitAttribute?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitBlock?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitClass?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitDeclaration?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitFunction?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitId?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitIdentifier?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitOperator?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitParentheses?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitProperty?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitPseudoElement?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitPunctuation?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitRule?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitSelector?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitSpace?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitValue?: (node: Node) => boolean;
    /**
     * Return false to prevent visiting sub-elements.
     */
    visitNumber?: (node: Node) => boolean;
}

export type VisitMode = "unscoped" | "scoped" | "disabled";

class StyleVisitorAdaptor {
    private mode: VisitMode = "unscoped";

    constructor(private vis: StyleVisitor) {}

    public visitNode(node: Node): Node {
        if (this.mode !== "scoped" && this.vis.startVisit && this.vis.startVisit(node)) {
            this.mode = "scoped";
        }

        if (!this.isString(node.value)) {
            (node.value as Node[]).forEach(cur => {
                switch (cur.type) {
                    case "arguments":
                        if (!this.shouldVisit(cur) || !this.vis.visitArguments || this.vis.visitArguments(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "property":
                        if (!this.shouldVisit(cur) || !this.vis.visitProperty || this.vis.visitProperty(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "atkeyword":
                        if (!this.shouldVisit(cur) || !this.vis.visitAtKeyword || this.vis.visitAtKeyword(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "atrule":
                        if (!this.shouldVisit(cur) || !this.vis.visitAtRule || this.vis.visitAtRule(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "attribute":
                        if (!this.shouldVisit(cur) || !this.vis.visitAttribute || this.vis.visitAttribute(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "block":
                        if (!this.shouldVisit(cur) || !this.vis.visitBlock || this.vis.visitBlock(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "class":
                        if (!this.shouldVisit(cur) || !this.vis.visitClass || this.vis.visitClass(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "declaration":
                        if (!this.shouldVisit(cur) || !this.vis.visitDeclaration || this.vis.visitDeclaration(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "function":
                        if (!this.shouldVisit(cur) || !this.vis.visitFunction || this.vis.visitFunction(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "id":
                        if (!this.shouldVisit(cur) || !this.vis.visitId || this.vis.visitId(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "parentheses":
                        if (!this.shouldVisit(cur) || !this.vis.visitParentheses || this.vis.visitParentheses(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "pseudo_class":
                    case "pseudo_element":
                        if (
                            this.shouldVisit(cur) &&
                            (!this.vis.visitPseudoElement || this.vis.visitPseudoElement(cur))
                        ) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "rule":
                        if (!this.shouldVisit(cur) || !this.vis.visitRule || this.vis.visitRule(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "selector":
                        if (!this.shouldVisit(cur) || !this.vis.visitSelector || this.vis.visitSelector(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "value":
                        if (!this.shouldVisit(cur) || !this.vis.visitValue || this.vis.visitValue(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "identifier":
                        if (!this.shouldVisit(cur) || !this.vis.visitIdentifier || this.vis.visitIdentifier(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "number":
                        if (!this.shouldVisit(cur) || !this.vis.visitNumber || this.vis.visitNumber(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "punctuation":
                        if (!this.shouldVisit(cur) || !this.vis.visitPunctuation || this.vis.visitPunctuation(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "operator":
                        if (!this.shouldVisit(cur) || !this.vis.visitOperator || this.vis.visitOperator(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    case "space":
                        if (!this.shouldVisit(cur) || !this.vis.visitSpace || this.vis.visitSpace(cur)) {
                            cur = this.visitNode(cur);
                        }
                        break;
                    default:
                        break;
                }
            });
        }
        if (this.mode !== "disabled" && this.vis.endVisit && this.vis.endVisit(node)) {
            this.mode = "disabled";
        }
        return node;
    }
    private shouldVisit(node: Node): boolean {
        return this.mode !== "disabled";
    }
    private isString(value: string | Node[]): value is string {
        return typeof value === "string";
    }
}

const parseStyles = (styles: string): Node => parse(styles);

const writeNode = (node: Node): string => stringify(node);

const visitNode = (node: Node, visitor: StyleVisitor): Node => {
    return new StyleVisitorAdaptor(visitor).visitNode(node);
};

export { Node, StyleVisitor, parseStyles, writeNode, visitNode };
