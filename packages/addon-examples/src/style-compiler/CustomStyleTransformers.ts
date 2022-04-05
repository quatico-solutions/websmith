import { StyleTransformer } from "./StyleTransformer";

export interface CustomStyleTransformers {
    after?: StyleTransformer[];
    before?: StyleTransformer[];
}
