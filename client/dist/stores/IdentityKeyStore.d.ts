import { IdentityKeyStore, PrivateKey, PublicKey, ProtocolAddress, Direction, IdentityChange } from '@signalapp/libsignal-client';
export declare class IdentityKeyStoreImpl extends IdentityKeyStore {
    private identityKey;
    private registrationId;
    private trustedIdentities;
    private dbName;
    private db;
    constructor();
    init(): Promise<void>;
    private loadFromDB;
    private loadIdentityFromDB;
    private loadTrustedIdentitiesFromDB;
    setIdentityKeyPair(privateKey: PrivateKey, registrationId: number): Promise<void>;
    private getIdentityId;
    getIdentityKey(): Promise<PrivateKey>;
    getLocalRegistrationId(): Promise<number>;
    saveIdentity(address: ProtocolAddress, key: PublicKey): Promise<IdentityChange>;
    isTrustedIdentity(address: ProtocolAddress, key: PublicKey, _direction: Direction): Promise<boolean>;
    getIdentity(address: ProtocolAddress): Promise<PublicKey | null>;
}
//# sourceMappingURL=IdentityKeyStore.d.ts.map