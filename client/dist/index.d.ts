import { SignalProtocol } from './protocol/signal';
import { GroupProtocol } from './protocol/groups';
import { KeyDistributionService } from './services/KeyDistributionService';
import { E2EStorage } from './storage/indexeddb';
export * from './protocol/signal';
export * from './protocol/groups';
export * from './protocol/SignalManager';
export * from './storage/indexeddb';
export * from './stores';
export * from './services/DMService';
export * from './services/KeyDistributionService';
export * from './components';
export interface E2EClient {
    signal: SignalProtocol;
    groups: GroupProtocol;
    storage: E2EStorage;
    keyDistribution: KeyDistributionService;
}
export declare class EfSecClient {
    private signal;
    private groups;
    private keyDistribution;
    private storage;
    private apiUrl;
    private authToken?;
    constructor(apiUrl: string);
    init(authToken?: string): Promise<void>;
    private setupInitialKeys;
    private registerKeys;
    startDMSession(userId: string): Promise<void>;
    encryptDM(userId: string, message: string): Promise<Uint8Array>;
    decryptDM(userId: string, ciphertext: Uint8Array): Promise<string>;
    createGroup(groupId: string): Promise<void>;
    joinGroup(groupId: string): Promise<void>;
    processIncomingKeyDistribution(senderId: string, encryptedMessage: Uint8Array): Promise<void>;
    processKeyRequest(senderId: string, encryptedMessage: Uint8Array): Promise<void>;
    encryptGroupMessage(groupId: string, message: string): Promise<Uint8Array>;
    decryptGroupMessage(groupId: string, senderId: string, senderDeviceId: number, ciphertext: Uint8Array): Promise<string>;
    rotateGroupKeys(groupId: string): Promise<void>;
    handleMemberRemoval(groupId: string, removedUserId: string): Promise<void>;
    handleNewMember(groupId: string, newMemberId: string): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map