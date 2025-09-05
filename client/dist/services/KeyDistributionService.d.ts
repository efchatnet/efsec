import { SignalProtocol } from '../protocol/signal';
import { GroupProtocol } from '../protocol/groups';
import { SenderKeyDistributionMessage } from '@signalapp/libsignal-client';
export interface KeyDistributionMessage {
    type: 'sender_key_distribution';
    groupId: string;
    senderKeyDistribution: Uint8Array;
    timestamp: number;
}
export declare class KeyDistributionService {
    private signalProtocol;
    private groupProtocol;
    private apiUrl;
    private authToken?;
    constructor(signalProtocol: SignalProtocol, groupProtocol: GroupProtocol, apiUrl: string, authToken?: string);
    /**
     * Distribute sender key to all group members via encrypted DMs
     */
    distributeGroupKeys(groupId: string, distributionMessage: SenderKeyDistributionMessage): Promise<void>;
    /**
     * Send sender key distribution via encrypted DM
     */
    private sendKeyDistributionDM;
    /**
     * Process received key distribution message
     */
    processKeyDistributionMessage(senderId: string, encryptedMessage: Uint8Array): Promise<void>;
    /**
     * Request sender keys from all group members
     */
    requestGroupKeys(groupId: string): Promise<void>;
    /**
     * Send a request for sender keys
     */
    private sendKeyRequest;
    /**
     * Handle key request from another member
     */
    processKeyRequest(senderId: string, encryptedMessage: Uint8Array): Promise<void>;
    /**
     * Rotate keys and distribute to all members
     */
    rotateAndDistributeKeys(groupId: string): Promise<void>;
    /**
     * Establish Signal session with a user
     */
    private establishSession;
    /**
     * Send encrypted DM via backend
     */
    private sendEncryptedDM;
    /**
     * Fetch group members from backend
     */
    private fetchGroupMembers;
    /**
     * Handle member removal - distribute new keys to remaining members
     */
    handleMemberRemoval(groupId: string, removedUserId: string): Promise<void>;
    /**
     * Handle new member joining - send them current keys and get theirs
     */
    handleNewMember(groupId: string, newMemberId: string): Promise<void>;
}
//# sourceMappingURL=KeyDistributionService.d.ts.map