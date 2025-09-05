import { JSX } from 'solid-js';
import { SignalManager } from '../protocol/SignalManager';
interface E2EContextType {
    signalManager: SignalManager | null;
    isInitialized: () => boolean;
    isEstablishingSession: () => boolean;
    error: () => string | null;
    initializeE2E: (apiUrl: string, authToken: string, userId: string) => Promise<void>;
    sendEncryptedMessage: (recipientId: string, message: string) => Promise<any>;
    decryptMessage: (senderId: string, encryptedData: string, messageType: number) => Promise<string>;
    hasSession: (userId: string) => Promise<boolean>;
}
export interface E2EProviderProps {
    children: JSX.Element;
    apiUrl: string;
    authToken: string | null;
    userId: string | null;
    autoInitialize?: boolean;
}
export declare function E2EProvider(props: E2EProviderProps): JSX.Element;
export declare function useE2E(): E2EContextType;
export {};
//# sourceMappingURL=E2EProvider.d.ts.map