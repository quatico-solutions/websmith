import { Address, EmailAddress, PhoneNumber } from "../api";
import { type MailConfiguration } from "../api/configuration/MailConfiguration";
import { type ProviderConfiguration } from "../api/configuration/ProviderConfiguration";
import { Entity } from "../base";
import { ContactEntity } from "../contacts";

export class ProviderConfigurationEntity
    extends Entity<ProviderConfiguration>
    implements ProviderConfiguration
{
    readonly name: string;
    readonly greeting: string;
    readonly logoDataUrl: string;
    readonly logoAltText: string;
    readonly bankingInfo: string;
    readonly vatNumber: string;
    readonly address: Address;
    readonly email: EmailAddress;
    readonly phone: PhoneNumber;
    readonly website: string;
    readonly salesContact: ContactEntity;
    readonly mailSettings: MailConfiguration;
    readonly termsOfServiceUrl?: string;
    readonly privacyPolicyUrl?: string;

    constructor(providerConfiguration: ProviderConfiguration) {
        super(providerConfiguration.id);
        this.name = providerConfiguration.name;
        this.greeting = providerConfiguration.greeting;
        this.logoDataUrl = providerConfiguration.logoDataUrl;
        this.logoAltText = providerConfiguration.logoAltText;
        this.bankingInfo = providerConfiguration.bankingInfo;
        this.vatNumber = providerConfiguration.vatNumber;
        this.address = Address.create(providerConfiguration.address);
        this.email = EmailAddress.create(providerConfiguration.email);
        this.phone = PhoneNumber.create(providerConfiguration.phone);
        this.website = providerConfiguration.website;
        this.salesContact = ContactEntity.create(providerConfiguration.salesContact);
        this.mailSettings = providerConfiguration.mailSettings;
        this.termsOfServiceUrl = providerConfiguration.termsOfServiceUrl;
        this.privacyPolicyUrl = providerConfiguration.privacyPolicyUrl;
    }

    static create(providerConfiguration: ProviderConfiguration): ProviderConfigurationEntity {
        if (!providerConfiguration.id || providerConfiguration.id.trim() === "") {
            throw new Error("ProviderConfigurationEntity: Property 'id' cannot be empty.");
        }
        return new ProviderConfigurationEntity(providerConfiguration);
    }

    toExternalData(): Record<string, string> {
        const data: Record<string, string> = {
            name: this.name,
            greeting: this.greeting,
            logoDataUrl: this.logoDataUrl,
            logoAltText: this.logoAltText,
            bankingInfo: this.bankingInfo,
            vatNumber: this.vatNumber,
            email: this.email,
            phone: this.phone,
            website: this.website,
        };

        if (this.termsOfServiceUrl) {
            data.termsOfServiceUrl = this.termsOfServiceUrl;
        }

        if (this.privacyPolicyUrl) {
            data.privacyPolicyUrl = this.privacyPolicyUrl;
        }

        return data;
    }
}
