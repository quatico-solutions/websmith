import { AddonActivator } from "./AddonActivator";

export type AddonModule = {
    activate: AddonActivator;
    name: string;
};
