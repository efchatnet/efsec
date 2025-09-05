import { SignalManager } from '../protocol/SignalManager';
export interface DMSpace {
    spaceId: string;
    userId: string;
    peerId: string;
    isE2EEnabled: boolean;
    sessionEstablished: boolean;
    createdAt: Date;
}
export interface DMServiceConfig {
    apiUrl: string;
    getAuthToken: () => string | null;
    signalManager?: SignalManager;
}
/**
 * Service for managing Direct Message spaces with E2E encryption
 */
export declare class DMService {
    private config;
    private signalManager?;
    constructor(config: DMServiceConfig);
    /**
     * Initialize or get existing DM space with another user
     * Automatically sets up E2E encryption
     */
    initiateDM(peerId: string): Promise<DMSpace>;
    /**
     * Find existing DM space with a user
     */
    private findExistingDM;
    /**
     * Establish E2E encryption session with peer
     */
    private establishE2ESession;
    /**
     * Get all DM spaces for current user
     */
    getUserDMs(): Promise<DMSpace[]>;
    /**
     * Check if a space is an E2E enabled DM
     */
    isDMSpace(spaceId: string): Promise<boolean>;
    /**
     * Enable E2E for an existing private space
     */
    enableE2EForSpace(spaceId: string): Promise<void>;
    /**
     * Set the SignalManager instance
     */
    setSignalManager(signalManager: SignalManager): void;
}
//# sourceMappingURL=DMService.d.ts.map