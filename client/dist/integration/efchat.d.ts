export interface E2EIntegrationConfig {
    apiUrl?: string;
    getAuthToken: () => string | null;
    onE2EStatusChange?: (_enabled: boolean) => void;
    debug?: boolean;
}
export interface MessageEnvelope {
    content: string;
    encrypted?: boolean;
    encryptionData?: {
        type: string;
        deviceId?: number;
    };
}
export interface WebSocketMessage {
    type: string;
    content?: string;
    isGroup?: boolean;
    encrypted?: boolean;
    encryptionData?: {
        type: string;
        deviceId?: number;
    };
    wasEncrypted?: boolean;
}
/**
 * Safe E2E wrapper that gracefully falls back to unencrypted messaging
 */
export declare class E2EIntegration {
    private client?;
    private isAvailable;
    private config;
    private initPromise?;
    constructor(config: E2EIntegrationConfig);
    /**
     * Check if E2E module is available
     */
    private checkAvailability;
    /**
     * Initialize E2E if available (non-blocking)
     */
    initializeE2E(userId: string): Promise<boolean>;
    private performInitialization;
    /**
     * Encrypt message if E2E is available, otherwise return plaintext
     */
    encryptMessage(recipientId: string, message: string, isGroup?: boolean): Promise<MessageEnvelope>;
    /**
     * Decrypt message if E2E is available and message is encrypted
     */
    decryptMessage(senderId: string, envelope: MessageEnvelope, isGroup?: boolean): Promise<string>;
    /**
     * Initiate DM if E2E is available
     */
    initiateDM(peerId: string): Promise<string | null>;
    /**
     * Check if E2E is ready
     */
    isE2EReady(): boolean;
    /**
     * Get E2E status
     */
    getStatus(): {
        available: boolean;
        initialized: boolean;
        hasSession: boolean;
    };
    /**
     * Cleanup E2E resources
     */
    cleanup(): Promise<void>;
}
/**
 * WebSocket message interceptor for automatic E2E handling
 */
export declare class E2EWebSocketInterceptor {
    private e2e;
    constructor(e2e: E2EIntegration);
    /**
     * Process outgoing message
     */
    processOutgoing(message: WebSocketMessage, recipientId?: string): Promise<WebSocketMessage>;
    /**
     * Process incoming message
     */
    processIncoming(message: WebSocketMessage, senderId?: string): Promise<WebSocketMessage>;
}
/**
 * Factory function for safe E2E integration
 */
export declare function createE2EIntegration(config: E2EIntegrationConfig): E2EIntegration;
//# sourceMappingURL=efchat.d.ts.map