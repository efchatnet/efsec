import { SenderKeyStore, SenderKeyRecord, ProtocolAddress, Uuid } from '@signalapp/libsignal-client';
export declare class SenderKeyStoreImpl extends SenderKeyStore {
    private senderKeys;
    private db;
    private dbName;
    constructor();
    init(): Promise<void>;
    private loadSenderKeysFromDB;
    private getSenderKeyId;
    saveSenderKey(sender: ProtocolAddress, distributionId: Uuid, record: SenderKeyRecord): Promise<void>;
    getSenderKey(sender: ProtocolAddress, distributionId: Uuid): Promise<SenderKeyRecord | null>;
    removeSenderKey(sender: ProtocolAddress, distributionId: Uuid): Promise<void>;
    removeAllSenderKeysForDistribution(distributionId: Uuid): Promise<void>;
}
//# sourceMappingURL=SenderKeyStore.d.ts.map