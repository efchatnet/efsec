import { GroupProtocol } from './groups';
export interface SignalManagerConfig {
    apiUrl: string;
    authToken: string;
    userId: string;
}
export interface EncryptedMessage {
    encrypted: string;
    type: number;
    deviceId?: number;
}
/**
 * High-level Signal Protocol manager for efchat integration
 * Handles key management, session establishment, and message encryption/decryption
 */
export declare class SignalManager {
    private signal;
    private groupProtocol;
    private config;
    private initialized;
    constructor(config: SignalManagerConfig);
    /**
     * Initialize the Signal Protocol and register keys with backend
     */
    initialize(): Promise<void>;
    /**
     * Generate and register initial Signal keys with the backend
     */
    private registerInitialKeys;
    /**
     * Establish a session with another user if not already established
     */
    establishSession(userId: string, deviceId?: number): Promise<void>;
    /**
     * Encrypt a message for a recipient
     */
    encryptMessage(recipientId: string, message: string, deviceId?: number): Promise<EncryptedMessage>;
    /**
     * Decrypt a received message
     */
    decryptMessage(senderId: string, encryptedData: string, messageType: number, deviceId?: number): Promise<string>;
    /**
     * Check and replenish one-time prekeys if running low
     */
    checkAndReplenishKeys(threshold?: number): Promise<void>;
    /**
     * Rotate signed prekey periodically (e.g., every 7 days)
     */
    rotateSignedPreKey(): Promise<void>;
    /**
     * Get the group protocol instance
     */
    getGroupProtocol(): GroupProtocol;
    /**
     * Cleanup and destroy session data
     */
    cleanup(): Promise<void>;
    /**
     * Check if Signal Protocol is ready
     */
    isReady(): boolean;
    /**
     * Check if a session exists with a user
     */
    hasSession(userId: string, deviceId?: number): Promise<boolean>;
}
//# sourceMappingURL=SignalManager.d.ts.map