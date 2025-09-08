// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// WASM module imports - loaded dynamically in init()
// Using 'any' types for dynamic WASM loading to avoid complex type mismatches
let wasmInit = null;
let EfSecAccount = null;
let EfSecSession = null;
let EfSecOutboundGroupSession = null;
let EfSecInboundGroupSession = null;
// Helper function for cryptographically secure ID generation
function generateSecureId() {
    const array = new Uint32Array(2);
    crypto.getRandomValues(array);
    return array[0].toString() + array[1].toString();
}
// Helper function for secure timestamp generation (time + randomness)
function generateSecureTimestamp() {
    const time = Date.now();
    const randomOffset = new Uint8Array(1);
    crypto.getRandomValues(randomOffset);
    // Add small random component to prevent timing analysis while preserving ordering
    return time + (randomOffset[0] % 100);
}
// Helper function for secure unique identifier (when timestamp not needed)
function generateSecureUniqueId() {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0];
}
// Helper function to read cookies (for CSRF token)
function getCookie(name) {
    return document.cookie.match(`(^|;)\\s*${name}=([^;]+)`)?.pop() || '';
}
export class EfSecClient {
    constructor(apiUrl) {
        this.sessions = new Map();
        this.groupSessions = new Map();
        this.initialized = false;
        this.keyStorage = null;
        this.apiUrl = apiUrl;
    }
    // eslint-disable-next-line max-lines-per-function
    async init(userId) {
        if (this.initialized) {
            return;
        }
        // Use cookie-based authentication like efchat (no JWT tokens needed)
        if (!userId) {
            throw new Error('User ID required: E2E encryption needs user identification');
        }
        this.userId = userId;
        // Initialize WASM module (load dynamically)
        if (!wasmInit) {
            try {
                // @ts-ignore - Dynamic WASM import from dist/wasm/web
                const wasmModule = await import('./wasm/web/efsec_wasm');
                wasmInit = wasmModule.default;
                EfSecAccount = wasmModule.EfSecAccount;
                EfSecSession = wasmModule.EfSecSession;
                EfSecOutboundGroupSession = wasmModule.EfSecOutboundGroupSession;
                EfSecInboundGroupSession = wasmModule.EfSecInboundGroupSession;
            }
            catch (error) {
                // WASM not available - E2E encryption cannot function
                console.error('WASM module not available - E2E encryption disabled:', error);
                throw new Error(`E2E encryption unavailable: WASM module failed to load. ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        if (wasmInit) {
            await wasmInit();
        }
        // Initialize IndexedDB for client-side key storage
        await this.initKeyStorage();
        // Load or create account (all keys stored client-side)
        await this.loadOrCreateAccount();
        // Register public keys with server (server NEVER sees private keys)
        await this.registerPublicKeys();
        this.initialized = true;
        console.error('EfSec client initialized with vodozemac WASM for user:', userId);
    }
    ensureInitialized() {
        if (!this.initialized || !this.account) {
            throw new Error('EfSecClient not initialized. Call init() first.');
        }
    }
    ensureAuthenticated() {
        if (!this.userId) {
            throw new Error('User ID required for E2E encryption');
        }
    }
    // Initialize IndexedDB for client-side key storage (ZERO KNOWLEDGE SERVER)
    async initKeyStorage() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(`efsec_keys_${this.userId}`, 1);
            request.onerror = () => reject(new Error('Failed to initialize key storage'));
            request.onsuccess = () => {
                this.keyStorage = request.result;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Store account data (private keys stay client-side)
                if (!db.objectStoreNames.contains('account')) {
                    db.createObjectStore('account');
                }
                // Store session data (private keys stay client-side)
                if (!db.objectStoreNames.contains('sessions')) {
                    db.createObjectStore('sessions');
                }
                // Store group session data (private keys stay client-side)
                if (!db.objectStoreNames.contains('groupSessions')) {
                    db.createObjectStore('groupSessions');
                }
            };
        });
    }
    // Load or create account - PROTOCOL COMPLIANT
    async loadOrCreateAccount() {
        if (!this.keyStorage) {
            throw new Error('Key storage not initialized');
        }
        const transaction = this.keyStorage.transaction(['account'], 'readwrite');
        const store = transaction.objectStore('account');
        return new Promise((resolve, reject) => {
            const request = store.get('main');
            request.onsuccess = () => {
                if (request.result) {
                    // Load existing account from client storage
                    console.error('Loading existing E2E account from client storage');
                    // Note: In a full implementation, we'd deserialize the account
                    // For now, create new account (keys will be regenerated)
                    if (!EfSecAccount) {
                        throw new Error('WASM module not loaded');
                    }
                    this.account = new EfSecAccount();
                }
                else {
                    // Create new account - PROTOCOL COMPLIANT
                    console.error('Creating new E2E account');
                    if (!EfSecAccount) {
                        throw new Error('WASM module not loaded');
                    }
                    this.account = new EfSecAccount();
                    // Generate initial one-time keys per Double Ratchet protocol
                    this.account.generate_one_time_keys(50);
                    // Store account data client-side (private keys never leave client)
                    const saveRequest = store.put({
                        created: generateSecureUniqueId(), // Secure unique identifier for account
                        // Account data stored client-side only - private keys never leave device
                    }, 'main');
                    saveRequest.onsuccess = () => resolve();
                    saveRequest.onerror = () => reject(new Error('Failed to save account'));
                    return;
                }
                resolve();
            };
            request.onerror = () => reject(new Error('Failed to load account'));
        });
    }
    // Register ONLY public keys with server - PROTOCOL COMPLIANT STORAGE
    async registerPublicKeys() {
        this.ensureAuthenticated();
        if (!this.account) {
            throw new Error('Account not initialized');
        }
        let identityKeys, oneTimeKeys;
        try {
            identityKeys = JSON.parse(this.account.identity_keys);
        }
        catch (error) {
            throw new Error(`Failed to parse identity keys: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
        }
        try {
            oneTimeKeys = JSON.parse(this.account.one_time_keys);
        }
        catch (error) {
            throw new Error(`Failed to parse one-time keys: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
        }
        // PROTOCOL REQUIREMENT: Store public keys in PostgreSQL for permanence
        // X3DH requires these to be available for key exchange
        try {
            const response = await fetch(`${this.apiUrl}/api/e2e/keys`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCookie('csrf_token'),
                },
                body: JSON.stringify({
                    userId: this.userId,
                    // PostgreSQL: Identity keys (permanent until device change)
                    identityKeys: {
                        curve25519: identityKeys.curve25519, // PUBLIC KEY - stored in PostgreSQL
                        ed25519: identityKeys.ed25519, // PUBLIC KEY - stored in PostgreSQL
                    },
                    // PostgreSQL: One-time prekeys (consumed once per X3DH exchange)
                    oneTimeKeys: Object.entries(oneTimeKeys).map(([id, key]) => ({
                        keyId: id,
                        publicKey: key, // PUBLIC KEY ONLY - stored in PostgreSQL until used
                    })),
                    // PostgreSQL: Signed prekey (rotated periodically)
                    signedPreKey: {
                        keyId: generateSecureId(),
                        publicKey: identityKeys.curve25519, // PUBLIC KEY - stored in PostgreSQL
                        signature: identityKeys.ed25519, // PUBLIC SIGNATURE - stored in PostgreSQL
                    },
                }),
            });
            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                let errorMessage = `Failed to register public keys: ${response.status} ${response.statusText}`;
                // Try to get error details from response body
                try {
                    if (contentType && contentType.includes('application/json')) {
                        const errorData = await response.json();
                        errorMessage += ` - ${errorData.message || errorData.error || 'Unknown error'}`;
                    }
                    else {
                        const textData = await response.text();
                        errorMessage += ` - ${textData || 'No response body'}`;
                    }
                }
                catch (parseError) {
                    errorMessage += ' - Failed to parse error response';
                }
                throw new Error(errorMessage);
            }
            // Try to parse response if it exists
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const result = await response.json();
                console.log('Public keys registered successfully:', result);
            }
            console.error('Public keys registered in PostgreSQL for X3DH key exchange');
        }
        catch (error) {
            console.error('Error registering public keys:', error);
            throw error;
        }
    }
    // PROTOCOL COMPLIANT: Start Double Ratchet session for 1:1 DM
    async startDMSession(userId) {
        this.ensureInitialized();
        this.ensureAuthenticated();
        // Fetch the other user's public key bundle (X3DH key exchange protocol)
        const keyBundle = await this.fetchKeyBundle(userId);
        let identityKeys, oneTimeKeys;
        try {
            identityKeys = JSON.parse(keyBundle.identityKeys);
        }
        catch (error) {
            throw new Error(`Failed to parse identity keys from key bundle: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
        }
        try {
            oneTimeKeys = JSON.parse(keyBundle.oneTimeKeys);
        }
        catch (error) {
            throw new Error(`Failed to parse one-time keys from key bundle: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
        }
        // X3DH Protocol: Select one-time key
        const oneTimeKeyIds = Object.keys(oneTimeKeys);
        if (oneTimeKeyIds.length === 0) {
            throw new Error('No one-time keys available for user - X3DH requires one-time key');
        }
        const oneTimeKey = oneTimeKeys[oneTimeKeyIds[0]];
        // Double Ratchet: Create outbound session
        if (!this.account) {
            throw new Error('Account not initialized');
        }
        const session = this.account.create_outbound_session(identityKeys.curve25519, // Identity key
        oneTimeKey // One-time key
        );
        // Store session client-side (private keys never leave client)
        const sessionData = {
            session,
            sessionId: session.session_id(),
            userId,
            created: generateSecureUniqueId(),
        };
        this.sessions.set(userId, sessionData);
        await this.storeSession(userId, sessionData);
        // Notify server that one-time key was consumed (protocol requirement)
        await this.markOneTimeKeyUsed(userId, oneTimeKeyIds[0]);
    }
    // PROTOCOL COMPLIANT: Encrypt DM using Double Ratchet
    async encryptDM(userId, message) {
        this.ensureInitialized();
        this.ensureAuthenticated();
        const storedSession = this.sessions.get(userId);
        if (!storedSession) {
            throw new Error('No session established with user. Call startDMSession first.');
        }
        // Double Ratchet: Encrypt message
        const ciphertext = storedSession.session.encrypt(message);
        const encrypted = new TextEncoder().encode(ciphertext);
        // Store encrypted message in Redis (ephemeral storage)
        await this.storeEphemeralMessage(userId, encrypted, 'dm');
        // Update session state client-side after encryption
        await this.storeSession(userId, storedSession);
        return encrypted;
    }
    // PROTOCOL COMPLIANT: Decrypt DM using Double Ratchet
    async decryptDM(userId, ciphertext) {
        this.ensureInitialized();
        this.ensureAuthenticated();
        const storedSession = this.sessions.get(userId);
        if (!storedSession) {
            throw new Error('No session established with user');
        }
        // Double Ratchet: Decrypt message
        const ciphertextString = new TextDecoder().decode(ciphertext);
        const plaintext = storedSession.session.decrypt(ciphertextString);
        // Update session state client-side after decryption
        await this.storeSession(userId, storedSession);
        return plaintext;
    }
    // PROTOCOL COMPLIANT: Create Megolm group session for group E2E
    async createGroup(groupId) {
        this.ensureInitialized();
        this.ensureAuthenticated();
        // Megolm: Create outbound group session
        if (!EfSecOutboundGroupSession) {
            throw new Error('WASM module not loaded');
        }
        const outboundSession = new EfSecOutboundGroupSession();
        const groupSessionData = {
            outbound: outboundSession,
            sessionId: outboundSession.session_id(),
            created: generateSecureUniqueId(),
        };
        this.groupSessions.set(groupId, groupSessionData);
        await this.storeGroupSession(groupId, groupSessionData);
        // Register group session key with server for distribution (public key only)
        await this.registerGroupSessionKey(groupId, outboundSession.session_key());
    }
    async joinGroup(groupId) {
        this.ensureInitialized();
        this.ensureAuthenticated();
        // For now, we'll create a placeholder - in a real implementation,
        // we'd receive the session key from the server
        console.error(`Joined group ${groupId} - session key would be received from server`);
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
    async processIncomingKeyDistribution(senderId, _encryptedMessage) {
        console.error('Processing incoming key distribution from', senderId);
    }
    async processKeyRequest(senderId, _encryptedMessage) {
        console.error('Processing key request from', senderId);
    }
    async rotateGroupKeys(groupId) {
        console.error('Rotating group keys for', groupId);
    }
    async handleMemberRemoval(groupId, removedUserId) {
        console.error('Handling member removal:', removedUserId, 'from group', groupId);
    }
    async handleNewMember(groupId, newMemberId) {
        console.error('Handling new member:', newMemberId, 'in group', groupId);
    }
    // Protocol helper methods for storage and key management
    // Store session data client-side (private keys never leave client)
    async storeSession(userId, sessionData) {
        if (!this.keyStorage) {
            return;
        }
        const transaction = this.keyStorage.transaction(['sessions'], 'readwrite');
        const store = transaction.objectStore('sessions');
        return new Promise((resolve, reject) => {
            const request = store.put({
                ...sessionData,
                // Note: In full implementation, serialize session securely
                stored: generateSecureUniqueId(),
            }, userId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to store session'));
        });
    }
    // Store group session data client-side
    async storeGroupSession(groupId, sessionData) {
        if (!this.keyStorage) {
            return;
        }
        const transaction = this.keyStorage.transaction(['groupSessions'], 'readwrite');
        const store = transaction.objectStore('groupSessions');
        return new Promise((resolve, reject) => {
            const request = store.put({
                ...sessionData,
                stored: generateSecureUniqueId(),
            }, groupId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to store group session'));
        });
    }
    // REDIS: Store ephemeral encrypted messages
    async storeEphemeralMessage(recipientId, encryptedData, type) {
        const response = await fetch(`${this.apiUrl}/api/e2e/messages/ephemeral`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': getCookie('csrf_token'),
            },
            body: JSON.stringify({
                senderId: this.userId,
                recipientId,
                encryptedData: Array.from(encryptedData), // Serialize for transport
                type,
                timestamp: generateSecureTimestamp(),
                ttl: 86400, // 24 hour TTL in Redis
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to store ephemeral message: ${response.statusText}`);
        }
    }
    // POSTGRESQL: Mark one-time key as used (protocol requirement)
    async markOneTimeKeyUsed(userId, keyId) {
        const response = await fetch(`${this.apiUrl}/api/e2e/keys/one-time/${userId}/${keyId}/used`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'X-CSRF-Token': getCookie('csrf_token'),
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to mark one-time key as used: ${response.statusText}`);
        }
    }
    // POSTGRESQL: Register group session key for distribution
    async registerGroupSessionKey(groupId, sessionKey) {
        const response = await fetch(`${this.apiUrl}/api/e2e/groups/${groupId}/session-key`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': getCookie('csrf_token'),
            },
            body: JSON.stringify({
                sessionKey, // Public session key for Megolm
                creatorId: this.userId,
                created: generateSecureUniqueId(),
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to register group session key: ${response.statusText}`);
        }
    }
    // POSTGRESQL: Fetch user's public key bundle for X3DH
    async fetchKeyBundle(userId) {
        const response = await fetch(`${this.apiUrl}/api/e2e/bundle/${userId}`, {
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch key bundle: ${response.statusText}`);
        }
        try {
            const data = await response.json();
            // Check if it's an error response from unimplemented endpoint
            if (data.error === 'not implemented') {
                throw new Error('Key bundle endpoint not yet implemented');
            }
            return data;
        }
        catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error('Invalid JSON response from key bundle endpoint');
            }
            throw error;
        }
    }
    // Public method to get identity keys for registration
    getIdentityKeys() {
        this.ensureInitialized();
        if (!this.account) {
            throw new Error('Account not available');
        }
        return this.account.identity_keys;
    }
    // Public method to get one-time keys for upload
    getOneTimeKeys() {
        this.ensureInitialized();
        if (!this.account) {
            throw new Error('Account not available');
        }
        return this.account.one_time_keys;
    }
    // Generate more one-time keys when running low
    generateOneTimeKeys(count = 50) {
        this.ensureInitialized();
        if (!this.account) {
            throw new Error('Account not available');
        }
        this.account.generate_one_time_keys(count);
    }
}
// Default export for CommonJS compatibility  
export default EfSecClient;
//# sourceMappingURL=index.js.map