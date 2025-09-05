import { KyberPreKeyStore, KyberPreKeyRecord } from '@signalapp/libsignal-client';
export declare class KyberPreKeyStoreImpl extends KyberPreKeyStore {
    private kyberPreKeys;
    private dbName;
    private storeName;
    private db;
    init(): Promise<void>;
    saveKyberPreKey(keyId: number, record: KyberPreKeyRecord): Promise<void>;
    getKyberPreKey(keyId: number): Promise<KyberPreKeyRecord>;
    markKyberPreKeyUsed(keyId: number): Promise<void>;
    countKyberPreKeys(): Promise<number>;
}
//# sourceMappingURL=KyberPreKeyStore.d.ts.map