import { PrivateKey, PublicKey, CiphertextMessage, CiphertextMessageType } from '@signalapp/libsignal-client';
export interface SignalKeys {
    identityKeyPair: {
        privateKey: PrivateKey;
        publicKey: PublicKey;
    };
    registrationId: number;
    signedPreKey: {
        keyId: number;
        keyPair: {
            privateKey: PrivateKey;
            publicKey: PublicKey;
        };
        signature: Uint8Array;
    };
    oneTimePreKeys: Array<{
        keyId: number;
        keyPair: {
            privateKey: PrivateKey;
            publicKey: PublicKey;
        };
    }>;
}
export declare class SignalProtocol {
    private sessionStore;
    private identityStore;
    private preKeyStore;
    private signedPreKeyStore;
    private kyberPreKeyStore;
    private initialized;
    constructor();
    initialize(): Promise<void>;
    generateIdentityKeyPair(): Promise<{
        privateKey: PrivateKey;
        publicKey: PublicKey;
    }>;
    generateRegistrationId(): Promise<number>;
    generateSignedPreKey(identityKey: PrivateKey, keyId: number): Promise<{
        keyId: number;
        keyPair: {
            privateKey: PrivateKey;
            publicKey: PublicKey;
        };
        signature: Uint8Array;
    }>;
    generatePreKeys(start: number, count: number): Promise<Array<{
        keyId: number;
        keyPair: {
            privateKey: PrivateKey;
            publicKey: PublicKey;
        };
    }>>;
    generateInitialKeys(): Promise<SignalKeys>;
    processPreKeyBundle(userId: string, deviceId: number, bundle: {
        registrationId: number;
        identityKey: Uint8Array;
        signedPreKeyId: number;
        signedPreKeyPublic: Uint8Array;
        signedPreKeySignature: Uint8Array;
        preKeyId?: number | null;
        preKeyPublic?: Uint8Array | null;
        kyberPreKeyId?: number;
        kyberPreKey?: Uint8Array;
        kyberPreKeySignature?: Uint8Array;
    }): Promise<void>;
    encryptMessage(userId: string, deviceId: number, message: Uint8Array): Promise<CiphertextMessage>;
    decryptMessage(userId: string, deviceId: number, ciphertext: Uint8Array, type: CiphertextMessageType): Promise<Uint8Array>;
    hasSession(userId: string, deviceId: number): Promise<boolean>;
    getRegistrationId(): Promise<number>;
    getIdentityKeyPair(): Promise<{
        privateKey: PrivateKey;
        publicKey: PublicKey;
    }>;
    getUnusedPreKeyCount(): Promise<number>;
    replenishPreKeys(start: number, count: number): Promise<Array<{
        keyId: number;
        publicKey: Uint8Array;
    }>>;
    rotateSignedPreKey(keyId: number): Promise<{
        keyId: number;
        publicKey: Uint8Array;
        signature: Uint8Array;
    }>;
}
//# sourceMappingURL=signal.d.ts.map