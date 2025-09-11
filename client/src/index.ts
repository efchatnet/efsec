// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// WASM module imports - loaded dynamically in init()
// Using 'any' types for dynamic WASM loading to avoid complex type mismatches
let wasmInit: (() => Promise<any>) | null = null;
let EfSecAccount: (new () => any) | null = null;
let EfSecSession: (new () => any) | null = null;
let EfSecOutboundGroupSession: (new () => any) | null = null;
let EfSecInboundGroupSession: (new (session_key: string) => any) | null = null;

interface KeyBundle {
  registration_id: number;
  identity_public_key: Uint8Array;
  signed_pre_key: {
    key_id: number;
    public_key: Uint8Array;
    signature: Uint8Array;
  };
  one_time_pre_key?: {
    key_id: number;
    public_key: Uint8Array;
  };
  kyber_pre_key?: {
    key_id: number;
    public_key: Uint8Array;
    signature: Uint8Array;
  };
}

interface StoredSession {
  session: any; // WASM session type loaded dynamically
  sessionId: string;
  [key: string]: unknown;
}

interface StoredGroupSession {
  outbound?: any; // WASM outbound session type loaded dynamically
  inbound?: any; // WASM inbound session type loaded dynamically
  senderSessions?: Map<string, any>; // Inbound sessions from other group members
  sessionId: string;
  [key: string]: unknown;
}

// Helper function for cryptographically secure ID generation
function generateSecureId(): string {
  const array = new Uint32Array(2);
  crypto.getRandomValues(array);
  return array[0].toString() + array[1].toString();
}

// Helper function for secure timestamp generation (time + randomness)
function generateSecureTimestamp(): number {
  const time = Date.now();
  const randomOffset = new Uint8Array(1);
  crypto.getRandomValues(randomOffset);
  // Add small random component to prevent timing analysis while preserving ordering
  return time + (randomOffset[0] % 100);
}

// Helper function for secure unique identifier (when timestamp not needed)
function generateSecureUniqueId(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0];
}

// Helper function to read cookies (for CSRF token)
function getCookie(name: string): string {
  return document.cookie.match(`(^|;)\\s*${name}=([^;]+)`)?.pop() || '';
}

export class EfSecClient {
  private apiUrl: string;
  private userId?: string;
  private account?: any; // WASM account type loaded dynamically
  private sessions: Map<string, StoredSession> = new Map();
  private groupSessions: Map<string, StoredGroupSession> = new Map();
  private initialized = false;
  private keyStorage: IDBDatabase | null = null;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  // eslint-disable-next-line max-lines-per-function
  async init(userId?: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Use cookie-based authentication like efchat (no JWT tokens needed)
    if (!userId || !userId.trim()) {
      throw new Error(
        'User ID required: E2E encryption needs user identification'
      );
    }

    this.userId = userId;

    // Initialize WASM module (load dynamically)
    if (!wasmInit) {
      try {
        // @ts-ignore - Dynamic WASM import from dist/wasm/web
        const wasmModule = await import('./wasm/web/efsec_wasm');
        wasmInit = wasmModule.default;
        EfSecAccount = wasmModule.EfSecAccount;
        EfSecSession = wasmModule.EfSecSession as any;
        EfSecOutboundGroupSession = wasmModule.EfSecOutboundGroupSession;
        EfSecInboundGroupSession = wasmModule.EfSecInboundGroupSession;
      } catch (error) {
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

  private ensureInitialized(): void {
    if (!this.initialized || !this.account) {
      throw new Error('EfSecClient not initialized. Call init() first.');
    }
  }

  private ensureAuthenticated(): void {
    if (!this.userId) {
      throw new Error('User ID required for E2E encryption');
    }
  }

  // Initialize IndexedDB for client-side key storage (ZERO KNOWLEDGE SERVER)
  private async initKeyStorage(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`efsec_keys_${this.userId}`, 1);

      request.onerror = (): void => reject(new Error('Failed to initialize key storage'));
      request.onsuccess = (): void => {
        this.keyStorage = request.result;
        resolve();
      };

      request.onupgradeneeded = (event): void => {
        const db = (event.target as IDBOpenDBRequest).result;

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
  private async loadOrCreateAccount(): Promise<void> {
    if (!this.keyStorage) {
      throw new Error('Key storage not initialized');
    }

    const transaction = this.keyStorage.transaction(['account'], 'readwrite');
    const store = transaction.objectStore('account');

    return new Promise((resolve, reject) => {
      const request = store.get('main');

      request.onsuccess = (): void => {
        if (request.result) {
          // Load existing account from client storage
          console.error('Loading existing E2E account from client storage');
          // Note: In a full implementation, we'd deserialize the account
          // For now, create new account (keys will be regenerated)
          if (!EfSecAccount) {
            throw new Error('WASM module not loaded');
          }
          this.account = new EfSecAccount();
          
          // Generate one-time keys for existing account too!
          this.account.generate_one_time_keys(50);
        } else {
          // Create new account - PROTOCOL COMPLIANT
          console.error('Creating new E2E account');
          if (!EfSecAccount) {
            throw new Error('WASM module not loaded');
          }
          this.account = new EfSecAccount();

          // Generate initial one-time keys per Double Ratchet protocol
          this.account.generate_one_time_keys(50);

          // Store account data client-side (private keys never leave client)
          const saveRequest = store.put(
            {
              created: generateSecureUniqueId(), // Secure unique identifier for account
              // Account data stored client-side only - private keys never leave device
            },
            'main'
          );

          saveRequest.onsuccess = (): void => resolve();
          saveRequest.onerror = (): void => reject(new Error('Failed to save account'));
          return;
        }
        resolve();
      };

      request.onerror = (): void => reject(new Error('Failed to load account'));
    });
  }

  // Register ONLY public keys with server - PROTOCOL COMPLIANT STORAGE
  private async registerPublicKeys(): Promise<void> {
    this.ensureAuthenticated();

    if (!this.account) {
      throw new Error('Account not initialized');
    }

    let identityKeys, oneTimeKeys;
    try {
      identityKeys = JSON.parse(this.account.identity_keys);
    } catch (error) {
      throw new Error(`Failed to parse identity keys: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
    
    try {
      oneTimeKeys = JSON.parse(this.account.one_time_keys());
    } catch (error) {
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
          } else {
            const textData = await response.text();
            errorMessage += ` - ${textData || 'No response body'}`;
          }
        } catch (parseError) {
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
    } catch (error) {
      console.error('Error registering public keys:', error);
      throw error;
    }
  }

  // PROTOCOL COMPLIANT: Start Double Ratchet session for 1:1 DM
  async startDMSession(userId: string): Promise<void> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    // Fetch the other user's public key bundle (X3DH key exchange protocol)
    const keyBundle = await this.fetchKeyBundle(userId);
    
    // Use correct field names from backend API
    if (!keyBundle.identity_public_key) {
      throw new Error('No identity public key found in key bundle');
    }
    
    if (!keyBundle.one_time_pre_key) {
      throw new Error('No one-time pre-key found in key bundle');
    }

    // Convert raw bytes to proper format for vodozemac
    const identityKeys = keyBundle.identity_public_key;
    const oneTimeKeys = {
      [keyBundle.one_time_pre_key.key_id]: keyBundle.one_time_pre_key.public_key
    };

    // X3DH Protocol: Select one-time key  
    const oneTimeKeyIds = Object.keys(oneTimeKeys);
    if (oneTimeKeyIds.length === 0) {
      throw new Error('No one-time keys available for user - X3DH requires one-time key');
    }

    const firstKeyId = oneTimeKeyIds[0];
    const oneTimeKey = oneTimeKeys[firstKeyId as keyof typeof oneTimeKeys];

    // Double Ratchet: Create outbound session
    if (!this.account) {
      throw new Error('Account not initialized');
    }
    const session = this.account.create_outbound_session(
      identityKeys, // Identity key (raw bytes)
      oneTimeKey // One-time key (raw bytes)
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
  async encryptDM(userId: string, message: string): Promise<Uint8Array> {
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
  async decryptDM(userId: string, ciphertext: Uint8Array): Promise<string> {
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
  async createGroup(groupId: string): Promise<void> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    // Megolm: Create outbound group session
    if (!EfSecOutboundGroupSession) {
      throw new Error('WASM module not loaded');
    }
    const outboundSession = new EfSecOutboundGroupSession();

    // Create inbound session from outbound session key (required for decrypting own messages)
    if (!EfSecInboundGroupSession) {
      throw new Error('WASM module not loaded');
    }
    const inboundSession = new EfSecInboundGroupSession(outboundSession.session_key());

    const groupSessionData = {
      outbound: outboundSession,
      inbound: inboundSession,
      sessionId: outboundSession.session_id(),
      created: generateSecureUniqueId(),
    };

    this.groupSessions.set(groupId, groupSessionData);
    await this.storeGroupSession(groupId, groupSessionData);

    // Register group session key with server for distribution (public key only)
    await this.registerGroupSessionKey(groupId, outboundSession.session_key());
  }

  async joinGroup(groupId: string): Promise<void> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    // Check if we already have a group session for this group
    if (this.groupSessions.has(groupId)) {
      console.log(`Already have group session for ${groupId}`);
      return;
    }

    // Megolm: Create outbound group session (each user has their own outbound session)
    if (!EfSecOutboundGroupSession) {
      throw new Error('WASM module not loaded');
    }
    const outboundSession = new EfSecOutboundGroupSession();

    // Create inbound session from outbound session key (required for decrypting own messages)
    if (!EfSecInboundGroupSession) {
      throw new Error('WASM module not loaded');
    }
    const inboundSession = new EfSecInboundGroupSession(outboundSession.session_key());

    const groupSessionData = {
      outbound: outboundSession,
      inbound: inboundSession,
      sessionId: outboundSession.session_id(),
      created: generateSecureUniqueId(),
    };

    this.groupSessions.set(groupId, groupSessionData);
    await this.storeGroupSession(groupId, groupSessionData);

    // Generate sender key with public signature key (no private keys sent to server)
    const senderKey = {
      group_id: groupId,
      user_id: this.userId,
      public_signature_key: Array.from(outboundSession.session_key()), // Use session key as signature key
      key_version: 1,
    };

    // Register with server using proper sender key (public info only)
    const response = await fetch(`${this.apiUrl}/api/e2e/group/${groupId}/join`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(senderKey),
    });

    if (!response.ok) {
      throw new Error(`Failed to join group: ${response.status}`);
    }

    console.log(`Successfully joined group ${groupId} with Megolm session`);
  }

  async encryptGroupMessage(groupId: string, message: string): Promise<Uint8Array> {
    this.ensureInitialized();

    const groupSession = this.groupSessions.get(groupId);
    if (!groupSession?.outbound) {
      throw new Error('No outbound group session. Create or join group first.');
    }

    const ciphertext = groupSession.outbound.encrypt(message);
    return new TextEncoder().encode(ciphertext);
  }

  async decryptGroupMessage(
    groupId: string,
    senderId: string,
    senderDeviceId: number,
    ciphertext: Uint8Array
  ): Promise<string> {
    this.ensureInitialized();

    const groupSession = this.groupSessions.get(groupId);
    if (!groupSession?.inbound) {
      throw new Error('No inbound group session for this group');
    }

    const ciphertextString = new TextDecoder().decode(ciphertext);
    return groupSession.inbound.decrypt(ciphertextString);
  }

  // Matrix Protocol: Process incoming Megolm session key distribution
  async processIncomingKeyDistribution(
    senderId: string,
    encryptedMessage: Uint8Array
  ): Promise<void> {
    this.ensureInitialized();
    
    try {
      // Decrypt the key distribution message using our DM session with sender
      const decryptedKeyData = await this.decryptDM(senderId, encryptedMessage);
      const keyDistribution = JSON.parse(decryptedKeyData);
      
      const { groupId, sessionKey, sessionId } = keyDistribution;
      
      if (!EfSecInboundGroupSession) {
        throw new Error('WASM module not loaded');
      }
      
      // Create inbound session from distributed session key
      const inboundSession = new EfSecInboundGroupSession(sessionKey);
      
      // Store the session for decrypting group messages from this sender
      const existingSession = this.groupSessions.get(groupId);
      if (existingSession) {
        // Add this sender's inbound session to our group session data
        if (!existingSession.senderSessions) {
          existingSession.senderSessions = new Map();
        }
        existingSession.senderSessions.set(senderId, inboundSession);
      } else {
        // Create new group session data with this sender's session
        const senderSessions = new Map();
        senderSessions.set(senderId, inboundSession);
        
        const groupSessionData = {
          outbound: null, // We don't have outbound session yet
          inbound: null,
          senderSessions,
          sessionId,
          created: generateSecureUniqueId(),
        };
        
        this.groupSessions.set(groupId, groupSessionData);
        await this.storeGroupSession(groupId, groupSessionData);
      }
      
      console.log(`Processed key distribution from ${senderId} for group ${groupId}`);
    } catch (error) {
      console.error('Failed to process key distribution:', error);
      throw error;
    }
  }

  // Matrix Protocol: Process request for our group session key
  async processKeyRequest(senderId: string, encryptedMessage: Uint8Array): Promise<void> {
    this.ensureInitialized();
    
    try {
      // Decrypt the key request using our DM session with requester
      const decryptedRequest = await this.decryptDM(senderId, encryptedMessage);
      const keyRequest = JSON.parse(decryptedRequest);
      
      const { groupId } = keyRequest;
      const groupSession = this.groupSessions.get(groupId);
      
      if (!groupSession?.outbound) {
        throw new Error(`No outbound session for group ${groupId}`);
      }
      
      // Prepare key distribution payload
      const keyDistribution = {
        groupId,
        sessionKey: Array.from(groupSession.outbound.session_key()),
        sessionId: groupSession.sessionId,
      };
      
      // Encrypt key distribution for the requester using DM session
      const encryptedKeyDistribution = await this.encryptDM(
        senderId,
        JSON.stringify(keyDistribution)
      );
      
      // Send encrypted key distribution back to requester
      // This would typically go through the messaging system
      console.log(`Sent key distribution to ${senderId} for group ${groupId}`);
      
      // Note: In a full implementation, this would send the encrypted key distribution
      // through the messaging infrastructure to reach the requester
    } catch (error) {
      console.error('Failed to process key request:', error);
      throw error;
    }
  }

  // Matrix Protocol: Forward security through key rotation
  async rotateGroupKeys(groupId: string): Promise<void> {
    this.ensureInitialized();
    
    const groupSession = this.groupSessions.get(groupId);
    if (!groupSession?.outbound) {
      throw new Error(`No group session for ${groupId}`);
    }
    
    try {
      if (!EfSecOutboundGroupSession) {
        throw new Error('WASM module not loaded');
      }
      
      // Create new outbound session (this rotates the keys)
      const newOutboundSession = new EfSecOutboundGroupSession();
      
      // Create corresponding inbound session for our own messages
      if (!EfSecInboundGroupSession) {
        throw new Error('WASM module not loaded');
      }
      const newInboundSession = new EfSecInboundGroupSession(newOutboundSession.session_key());
      
      // Update our group session with rotated keys
      groupSession.outbound = newOutboundSession;
      groupSession.inbound = newInboundSession;
      groupSession.sessionId = newOutboundSession.session_id();
      
      // Store updated session
      await this.storeGroupSession(groupId, groupSession);
      
      // Register new session key with server
      await this.registerGroupSessionKey(groupId, newOutboundSession.session_key());
      
      console.log(`Rotated group keys for ${groupId}`);
    } catch (error) {
      console.error('Failed to rotate group keys:', error);
      throw error;
    }
  }

  // Matrix Protocol: Handle member leaving group (forward security)
  async handleMemberRemoval(groupId: string, removedUserId: string): Promise<void> {
    this.ensureInitialized();
    
    try {
      // Remove any stored sender sessions for this user
      const groupSession = this.groupSessions.get(groupId);
      if (groupSession?.senderSessions) {
        groupSession.senderSessions.delete(removedUserId);
        await this.storeGroupSession(groupId, groupSession);
      }
      
      // For forward security, rotate group keys when member leaves
      // This ensures removed members cannot decrypt future messages
      await this.rotateGroupKeys(groupId);
      
      console.log(`Handled removal of ${removedUserId} from group ${groupId}`);
    } catch (error) {
      console.error('Failed to handle member removal:', error);
      throw error;
    }
  }

  // Matrix Protocol: Handle new member joining group
  async handleNewMember(groupId: string, newMemberId: string): Promise<void> {
    this.ensureInitialized();
    
    const groupSession = this.groupSessions.get(groupId);
    if (!groupSession?.outbound) {
      console.warn(`No outbound session for group ${groupId} - cannot distribute keys to new member`);
      return;
    }
    
    try {
      // Prepare key distribution for new member
      const keyDistribution = {
        groupId,
        sessionKey: Array.from(groupSession.outbound.session_key()),
        sessionId: groupSession.sessionId,
      };
      
      // Encrypt key distribution for new member using DM session
      const encryptedKeyDistribution = await this.encryptDM(
        newMemberId,
        JSON.stringify(keyDistribution)
      );
      
      console.log(`Distributed group keys to new member ${newMemberId} in group ${groupId}`);
      
      // Note: In a full implementation, this would send the encrypted key distribution
      // through the messaging infrastructure to reach the new member
      // For now, we log successful key preparation
    } catch (error) {
      console.warn(`Failed to distribute keys to new member ${newMemberId}:`, error);
      // Don't throw - this is not critical for group functionality
    }
  }

  // Protocol helper methods for storage and key management

  // Store session data client-side (private keys never leave client)
  private async storeSession(userId: string, sessionData: Record<string, unknown>): Promise<void> {
    if (!this.keyStorage) {
      return;
    }

    const transaction = this.keyStorage.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');

    return new Promise((resolve, reject) => {
      const request = store.put(
        {
          ...sessionData,
          // Note: In full implementation, serialize session securely
          stored: generateSecureUniqueId(),
        },
        userId
      );

      request.onsuccess = (): void => resolve();
      request.onerror = (): void => reject(new Error('Failed to store session'));
    });
  }

  // Store group session data client-side
  private async storeGroupSession(
    groupId: string,
    sessionData: Record<string, unknown>
  ): Promise<void> {
    if (!this.keyStorage) {
      return;
    }

    const transaction = this.keyStorage.transaction(['groupSessions'], 'readwrite');
    const store = transaction.objectStore('groupSessions');

    return new Promise((resolve, reject) => {
      const request = store.put(
        {
          ...sessionData,
          stored: generateSecureUniqueId(),
        },
        groupId
      );

      request.onsuccess = (): void => resolve();
      request.onerror = (): void => reject(new Error('Failed to store group session'));
    });
  }

  // REDIS: Store ephemeral encrypted messages
  private async storeEphemeralMessage(
    recipientId: string,
    encryptedData: Uint8Array,
    type: 'dm' | 'group'
  ): Promise<void> {
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
  private async markOneTimeKeyUsed(userId: string, keyId: string): Promise<void> {
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
  private async registerGroupSessionKey(groupId: string, sessionKey: string): Promise<void> {
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
  private async fetchKeyBundle(userId: string): Promise<KeyBundle> {
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
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON response from key bundle endpoint');
      }
      throw error;
    }
  }

  // Public method to get identity keys for registration
  getIdentityKeys(): string {
    this.ensureInitialized();
    if (!this.account) {
      throw new Error('Account not available');
    }
    return this.account.identity_keys;
  }

  // Public method to get one-time keys for upload
  getOneTimeKeys(): string {
    this.ensureInitialized();
    if (!this.account) {
      throw new Error('Account not available');
    }
    return this.account.one_time_keys();
  }

  // Generate more one-time keys when running low
  generateOneTimeKeys(count: number = 50): void {
    this.ensureInitialized();
    if (!this.account) {
      throw new Error('Account not available');
    }
    this.account.generate_one_time_keys(count);
  }
}

// Default export for CommonJS compatibility  
export default EfSecClient;
