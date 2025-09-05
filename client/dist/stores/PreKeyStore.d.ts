import { PreKeyStore, PreKeyRecord } from '@signalapp/libsignal-client';
export declare class PreKeyStoreImpl extends PreKeyStore {
    private preKeys;
    private dbName;
    private db;
    constructor();
    init(): Promise<void>;
    private loadFromDB;
    private savePreKeyToDB;
    private removePreKeyFromDB;
    savePreKey(id: number, record: PreKeyRecord): Promise<void>;
    getPreKey(id: number): Promise<PreKeyRecord>;
    removePreKey(id: number): Promise<void>;
    containsPreKey(id: number): Promise<boolean>;
    getAllPreKeyIds(): Promise<number[]>;
    countPreKeys(): Promise<number>;
}
//# sourceMappingURL=PreKeyStore.d.ts.map