import { SenderKeyDistributionMessage } from '@signalapp/libsignal-client';
import { SignalProtocol } from './signal';
export interface GroupMember {
    userId: string;
    deviceId: number;
}
export declare class GroupProtocol {
    private senderKeyStore;
    private groupDistributionIds;
    private initialized;
    constructor(_signalProtocol: SignalProtocol);
    initialize(): Promise<void>;
    private loadGroupDistributionIds;
    private openGroupDB;
    createGroup(groupId: string): Promise<SenderKeyDistributionMessage>;
    joinGroup(groupId: string, distributionId: string): Promise<void>;
    processSenderKeyDistribution(groupId: string, senderId: string, senderDeviceId: number, distributionMessage: Uint8Array): Promise<void>;
    encryptGroupMessage(groupId: string, plaintext: Uint8Array): Promise<Uint8Array>;
    decryptGroupMessage(groupId: string, senderId: string, senderDeviceId: number, ciphertext: Uint8Array): Promise<Uint8Array>;
    addGroupMember(groupId: string, userId: string, deviceId: number): Promise<void>;
    removeGroupMember(groupId: string, userId: string, deviceId: number): Promise<void>;
    getGroupMembers(groupId: string): Promise<GroupMember[]>;
    rotateGroupKeys(groupId: string): Promise<SenderKeyDistributionMessage>;
    leaveGroup(groupId: string): Promise<void>;
    isGroupMember(groupId: string): Promise<boolean>;
    getGroupDistributionId(groupId: string): Promise<string | null>;
}
//# sourceMappingURL=groups.d.ts.map