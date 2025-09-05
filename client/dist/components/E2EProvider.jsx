// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
import { createContext, useContext, createSignal } from 'solid-js';
const E2EContext = createContext();
export function E2EProvider(props) {
    const [isInitialized] = createSignal(false);
    const [isEstablishingSession] = createSignal(false);
    const [error] = createSignal('E2E encryption not available: Signal Protocol requires native dependencies not supported in browsers');
    const initializeE2E = async (apiUrl, authToken, userId) => {
        throw new Error('E2E encryption not available: Signal Protocol requires native dependencies not supported in browsers');
    };
    const sendEncryptedMessage = async (recipientId, message) => {
        throw new Error('E2E encryption not available in browsers');
    };
    const decryptMessage = async (senderId, encryptedData, messageType) => {
        throw new Error('E2E encryption not available in browsers');
    };
    const hasSession = async (userId) => {
        return false;
    };
    // E2E disabled in browser environment
    const value = {
        signalManager: null,
        isInitialized,
        isEstablishingSession,
        error,
        initializeE2E,
        sendEncryptedMessage,
        decryptMessage,
        hasSession
    };
    return (<E2EContext.Provider value={value}>
      {props.children}
    </E2EContext.Provider>);
}
export function useE2E() {
    const context = useContext(E2EContext);
    if (!context) {
        throw new Error('useE2E must be used within E2EProvider');
    }
    return context;
}
//# sourceMappingURL=E2EProvider.jsx.map