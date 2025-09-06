import { JSX } from 'solid-js';
import { EfSecClient } from '../index';
interface E2EContextType {
    client: EfSecClient | null;
    isInitialized: () => boolean;
    isEstablishingSession: () => boolean;
    error: () => string | null;
    initializeE2E: (apiUrl: string, authToken: string, userId: string) => Promise<void>;
    sendEncryptedMessage: (recipientId: string, message: string) => Promise<Uint8Array>;
    decryptMessage: (senderId: string, encryptedData: Uint8Array) => Promise<string>;
    hasSession: (userId: string) => boolean;
    createGroup: (groupId: string) => Promise<void>;
    encryptGroupMessage: (groupId: string, message: string) => Promise<Uint8Array>;
    decryptGroupMessage: (groupId: string, senderId: string, ciphertext: Uint8Array) => Promise<string>;
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