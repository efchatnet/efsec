"use strict";
// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
Object.defineProperty(exports, "__esModule", { value: true });
exports.E2EProvider = E2EProvider;
exports.useE2E = useE2E;
const solid_js_1 = require("solid-js");
const SignalManager_1 = require("../protocol/SignalManager");
const E2EContext = (0, solid_js_1.createContext)();
function E2EProvider(props) {
    const [signalManager, setSignalManager] = (0, solid_js_1.createSignal)(null);
    const [isInitialized, setIsInitialized] = (0, solid_js_1.createSignal)(false);
    const [isEstablishingSession, setIsEstablishingSession] = (0, solid_js_1.createSignal)(false);
    const [error, setError] = (0, solid_js_1.createSignal)(null);
    const initializeE2E = async (apiUrl, authToken, userId) => {
        try {
            setError(null);
            const manager = new SignalManager_1.SignalManager({
                apiUrl,
                authToken,
                userId
            });
            await manager.initialize();
            setSignalManager(manager);
            setIsInitialized(true);
            // Check and replenish keys if needed
            await manager.checkAndReplenishKeys(20);
            console.log('E2E encryption initialized successfully');
        }
        catch (err) {
            console.error('Failed to initialize E2E:', err);
            setError(err instanceof Error ? err.message : 'Failed to initialize E2E');
            setIsInitialized(false);
        }
    };
    const sendEncryptedMessage = async (recipientId, message) => {
        const manager = signalManager();
        if (!manager)
            throw new Error('E2E not initialized');
        setIsEstablishingSession(true);
        try {
            const encrypted = await manager.encryptMessage(recipientId, message);
            // Send via API
            const response = await fetch(`${props.apiUrl}/api/e2e/dm/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${props.authToken}`
                },
                body: JSON.stringify({
                    recipient_id: recipientId,
                    ciphertext: encrypted.encrypted,
                    message_type: encrypted.type,
                    device_id: encrypted.deviceId
                })
            });
            if (!response.ok) {
                throw new Error('Failed to send encrypted message');
            }
            return await response.json();
        }
        finally {
            setIsEstablishingSession(false);
        }
    };
    const decryptMessage = async (senderId, encryptedData, messageType) => {
        const manager = signalManager();
        if (!manager)
            throw new Error('E2E not initialized');
        return await manager.decryptMessage(senderId, encryptedData, messageType);
    };
    const hasSession = async (userId) => {
        const manager = signalManager();
        if (!manager)
            return false;
        // Check if session exists (this is a method we need to add to SignalManager)
        try {
            const sessionExists = await manager.hasSession(userId);
            return sessionExists;
        }
        catch {
            return false;
        }
    };
    (0, solid_js_1.onMount)(() => {
        if (props.autoInitialize && props.authToken && props.userId) {
            initializeE2E(props.apiUrl, props.authToken, props.userId);
        }
    });
    const value = {
        signalManager: signalManager(),
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
function useE2E() {
    const context = (0, solid_js_1.useContext)(E2EContext);
    if (!context) {
        throw new Error('useE2E must be used within E2EProvider');
    }
    return context;
}
//# sourceMappingURL=E2EProvider.jsx.map