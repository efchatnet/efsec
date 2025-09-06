// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// Component exports (SolidJS)
export * from './components';
import init, { EfSecAccount, EfSecOutboundGroupSession } from './wasm/efsec_wasm';
export class EfSecClient {
    constructor(apiUrl) {
        this.sessions = new Map();
        this.groupSessions = new Map();
        this.initialized = false;
        this.apiUrl = apiUrl;
    }
    async init(authToken) {
        if (this.initialized)
            return;
        this.authToken = authToken;
        // Initialize WASM module
        await init();
        // Create new account
        this.account = new EfSecAccount();
        // Generate initial one-time keys
        this.account.generate_one_time_keys(50);
        this.initialized = true;
        console.log('EfSec client initialized with vodozemac WASM');
    }
    ensureInitialized() {
        if (!this.initialized || !this.account) {
            throw new Error('EfSecClient not initialized. Call init() first.');
        }
    }
    ensureAuthenticated() {
        if (!this.authToken) {
            throw new Error('Authentication required for E2E encryption');
        }
    }
    async startDMSession(userId) {
        this.ensureInitialized();
        this.ensureAuthenticated();
        // Fetch the other user's key bundle
        const keyBundle = await this.fetchKeyBundle(userId);
        const identityKeys = JSON.parse(keyBundle.identityKeys);
        const oneTimeKeys = JSON.parse(keyBundle.oneTimeKeys);
        // Get the first available one-time key
        const oneTimeKeyIds = Object.keys(oneTimeKeys);
        if (oneTimeKeyIds.length === 0) {
            throw new Error('No one-time keys available for user');
        }
        const oneTimeKey = oneTimeKeys[oneTimeKeyIds[0]];
        // Create outbound session
        const session = this.account.create_outbound_session(identityKeys.curve25519, oneTimeKey);
        this.sessions.set(userId, {
            session,
            sessionId: session.session_id()
        });
    }
    async encryptDM(userId, message) {
        this.ensureInitialized();
        const storedSession = this.sessions.get(userId);
        if (!storedSession) {
            throw new Error('No session established with user. Call startDMSession first.');
        }
        const ciphertext = storedSession.session.encrypt(message);
        return new TextEncoder().encode(ciphertext);
    }
    async decryptDM(userId, ciphertext) {
        this.ensureInitialized();
        const storedSession = this.sessions.get(userId);
        if (!storedSession) {
            throw new Error('No session established with user');
        }
        const ciphertextString = new TextDecoder().decode(ciphertext);
        return storedSession.session.decrypt(ciphertextString);
    }
    async createGroup(groupId) {
        this.ensureInitialized();
        this.ensureAuthenticated();
        const outboundSession = new EfSecOutboundGroupSession();
        this.groupSessions.set(groupId, {
            outbound: outboundSession,
            sessionId: outboundSession.session_id()
        });
    }
    async joinGroup(groupId) {
        this.ensureInitialized();
        this.ensureAuthenticated();
        // For now, we'll create a placeholder - in a real implementation,
        // we'd receive the session key from the server
        console.log(`Joined group ${groupId} - session key would be received from server`);
    }
    async encryptGroupMessage(groupId, message) {
        this.ensureInitialized();
        const groupSession = this.groupSessions.get(groupId);
        if (!groupSession?.outbound) {
            throw new Error('No outbound group session. Create or join group first.');
        }
        const ciphertext = groupSession.outbound.encrypt(message);
        return new TextEncoder().encode(ciphertext);
    }
    async decryptGroupMessage(groupId, senderId, senderDeviceId, ciphertext) {
        this.ensureInitialized();
        const groupSession = this.groupSessions.get(groupId);
        if (!groupSession?.inbound) {
            throw new Error('No inbound group session for this group');
        }
        const ciphertextString = new TextDecoder().decode(ciphertext);
        return groupSession.inbound.decrypt(ciphertextString);
    }
    // Placeholder implementations for other methods
    async processIncomingKeyDistribution(senderId, encryptedMessage) {
        console.log('Processing incoming key distribution from', senderId);
    }
    async processKeyRequest(senderId, encryptedMessage) {
        console.log('Processing key request from', senderId);
    }
    async rotateGroupKeys(groupId) {
        console.log('Rotating group keys for', groupId);
    }
    async handleMemberRemoval(groupId, removedUserId) {
        console.log('Handling member removal:', removedUserId, 'from group', groupId);
    }
    async handleNewMember(groupId, newMemberId) {
        console.log('Handling new member:', newMemberId, 'in group', groupId);
    }
    async fetchKeyBundle(userId) {
        const response = await fetch(`${this.apiUrl}/api/e2e/bundle/${userId}`, {
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch key bundle: ${response.statusText}`);
        }
        return response.json();
    }
    // Public method to get identity keys for registration
    getIdentityKeys() {
        this.ensureInitialized();
        return this.account.identity_keys;
    }
    // Public method to get one-time keys for upload
    getOneTimeKeys() {
        this.ensureInitialized();
        return this.account.one_time_keys();
    }
    // Generate more one-time keys when running low
    generateOneTimeKeys(count = 50) {
        this.ensureInitialized();
        this.account.generate_one_time_keys(count);
    }
}
export default EfSecClient;
//# sourceMappingURL=index.js.map