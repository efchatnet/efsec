import { SignedPreKeyStore, SignedPreKeyRecord } from '@signalapp/libsignal-client';
export declare class SignedPreKeyStoreImpl extends SignedPreKeyStore {
    private signedPreKeys;
    private dbName;
    private db;
    constructor();
    init(): Promise<void>;
    private loadFromDB;
    private saveSignedPreKeyToDB;
    saveSignedPreKey(id: number, record: SignedPreKeyRecord): Promise<void>;
    getSignedPreKey(id: number): Promise<SignedPreKeyRecord>;
    containsSignedPreKey(id: number): Promise<boolean>;
    removeSignedPreKey(id: number): Promise<void>;
    getAllSignedPreKeyIds(): Promise<number[]>;
}
//# sourceMappingURL=SignedPreKeyStore.d.ts.map