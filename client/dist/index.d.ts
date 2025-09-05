export * from './components';
export declare class EfSecClient {
    constructor(apiUrl: string);
    init(authToken?: string): Promise<void>;
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
export default EfSecClient;
//# sourceMappingURL=index.d.ts.map