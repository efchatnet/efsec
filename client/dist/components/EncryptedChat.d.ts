import { Component } from 'solid-js';
export interface EncryptedMessage {
    id: string;
    senderId: string;
    recipientId: string;
    ciphertext: string;
    messageType: number;
    timestamp: Date;
    decrypted?: string;
    isOutgoing?: boolean;
}
export interface EncryptedChatProps {
    recipientId: string;
    recipientName: string;
    currentUserId: string;
    messages: EncryptedMessage[];
    onSendMessage?: (message: EncryptedMessage) => void;
    onDecryptMessage?: (messageId: string, decrypted: string) => void;
    class?: string;
}
export declare const EncryptedChat: Component<EncryptedChatProps>;
//# sourceMappingURL=EncryptedChat.d.ts.map