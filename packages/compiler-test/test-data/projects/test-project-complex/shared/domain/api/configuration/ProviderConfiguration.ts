/* eslint-disable @typescript-eslint/no-namespace */
import { type ContactEntity } from "../../contacts";
import { type Address, type EmailAddress, type PhoneNumber } from "../contacts";
import { type MailConfiguration } from "./MailConfiguration";

export type ProviderConfiguration = {
    id: ProviderConfiguration.Id;
    name: string;
    greeting: string;
    logoDataUrl: string;
    logoAltText: string;
    bankingInfo: string;
    vatNumber: string;
    address: Address;
    email: EmailAddress;
    phone: PhoneNumber;
    website: string;
    salesContact: ContactEntity;
    mailSettings: MailConfiguration;
    termsOfServiceUrl?: string;
    privacyPolicyUrl?: string;
};

export namespace ProviderConfiguration {
    /**
     * The id of the provider to identify it.
     *
     * Must be a non-empty ID string.
     */
    export type Id = string;

    /**
     * Creates a new order id.
     *
     * @param value The value to create the id from.
     * @returns The new order id.
     * @throws An error if the id is empty.
     */
    export const Id = (_value: string) => {
        throw new Error("ProviderConfiguration: Property 'id' cannot be empty.");
    };

    /**
     * Creates a new order id.
     *
     * @returns The new order id.
     */
    export const createId = (): Id => {
        return Id(crypto.randomUUID());
    };
}
