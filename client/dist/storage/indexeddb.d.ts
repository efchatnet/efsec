export interface StoredKeys {
    identityKeyPair: Uint8Array;
    registrationId: number;
    signedPreKey: {
        keyId: number;
        keyPair: Uint8Array;
        signature: Uint8Array;
    };
    oneTimePreKeys: Array<{
        keyId: number;
        keyPair: Uint8Array;
    }>;
}
export interface StoredSession {
    userId: string;
    sessionData: Uint8Array;
}
export interface StoredSenderKey {
    groupId: string;
    chainKey: Uint8Array;
    signatureKeyPair: {
        privateKey: Uint8Array;
        publicKey: Uint8Array;
    };
    keyVersion: number;
}
export declare class E2EStorage {
    private dbName;
    private db;
    init(): Promise<void>;
    saveIdentityKeys(keys: StoredKeys): Promise<void>;
    getIdentityKeys(): Promise<StoredKeys | null>;
    saveSession(userId: string, sessionData: Uint8Array): Promise<void>;
    getSession(userId: string): Promise<Uint8Array | null>;
    saveSenderKey(senderKey: StoredSenderKey): Promise<void>;
    getSenderKey(groupId: string): Promise<StoredSenderKey | null>;
    clearAll(): Promise<void>;
}
//# sourceMappingURL=indexeddb.d.ts.map