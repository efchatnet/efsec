import { SessionStore, SessionRecord, ProtocolAddress } from '@signalapp/libsignal-client';
export declare class SessionStoreImpl extends SessionStore {
    private sessions;
    private dbName;
    private db;
    constructor();
    init(): Promise<void>;
    private loadSessionsFromDB;
    private saveSessionToDB;
    private getSessionId;
    saveSession(address: ProtocolAddress, record: SessionRecord): Promise<void>;
    getSession(address: ProtocolAddress): Promise<SessionRecord | null>;
    getExistingSessions(addresses: ProtocolAddress[]): Promise<SessionRecord[]>;
}
//# sourceMappingURL=SessionStore.d.ts.map