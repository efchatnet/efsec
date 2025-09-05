// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import { SignalProtocol, SignalKeys } from './protocol/signal';
import { SenderKeysProtocol, SenderKey, GroupSession } from './protocol/senderkeys';
import { E2EStorage } from './storage/indexeddb';

// Core Protocol exports
export * from './protocol/signal';
export * from './protocol/senderkeys';
export * from './protocol/SignalManager';
export * from './protocol/groups';

// Storage exports
export * from './storage/indexeddb';
export * from './stores';

// Service exports
export * from './services/DMService';

// React Component exports
export * from './components/E2EStatusIndicator';
export * from './components/E2ELockIcon';
export * from './components/DMInitiator';

// React Hook exports
export * from './hooks/useE2EMessaging';

export interface E2EClient {
  signal: SignalProtocol;
  senderKeys: SenderKeysProtocol;
  storage: E2EStorage;
}

export class EfSecClient {
  private signal: SignalProtocol;
  private senderKeys: SenderKeysProtocol;
  private storage: E2EStorage;
  private apiUrl: string;
  private authToken?: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
    this.signal = new SignalProtocol();
    this.senderKeys = new SenderKeysProtocol();
    this.storage = new E2EStorage();
  }

  async init(authToken?: string): Promise<void> {
    this.authToken = authToken;
    await this.storage.init();
    
    // Load existing keys if available
    const storedKeys = await this.storage.getIdentityKeys();
    if (!storedKeys) {
      // Generate and register new keys
      await this.setupInitialKeys();
    }
  }

  private async setupInitialKeys(): Promise<void> {
    const keys = await this.signal.generateInitialKeys();
    
    // Save to IndexedDB
    await this.storage.saveIdentityKeys({
      identityKeyPair: keys.identityKeyPair.serialize(),
      registrationId: keys.registrationId,
      signedPreKey: {
        keyId: keys.signedPreKey.keyId,
        keyPair: keys.signedPreKey.keyPair.serialize(),
        signature: keys.signedPreKey.signature
      },
      oneTimePreKeys: keys.oneTimePreKeys.map(pk => ({
        keyId: pk.keyId,
        keyPair: pk.keyPair.serialize()
      }))
    });

    // Register with backend
    await this.registerKeys(keys);
  }

  private async registerKeys(keys: SignalKeys): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/e2e/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({
        registration_id: keys.registrationId,
        identity_public_key: Array.from(keys.identityKeyPair.getPublicKey().serialize()),
        signed_pre_key: {
          id: keys.signedPreKey.keyId,
          public_key: Array.from(keys.signedPreKey.keyPair.getPublicKey().serialize()),
          signature: Array.from(keys.signedPreKey.signature)
        },
        one_time_pre_keys: keys.oneTimePreKeys.map(pk => ({
          id: pk.keyId,
          public_key: Array.from(pk.keyPair.getPublicKey().serialize())
        }))
      })
    });

    if (!response.ok) {
      throw new Error('Failed to register keys');
    }
  }

  async startDMSession(userId: string): Promise<void> {
    // Fetch recipient's prekey bundle
    const response = await fetch(`${this.apiUrl}/api/e2e/bundle/${userId}`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch prekey bundle');
    }

    const bundle = await response.json();
    const storedKeys = await this.storage.getIdentityKeys();
    
    if (!storedKeys) {
      throw new Error('No identity keys found');
    }

    // Process the prekey bundle to establish session
    await this.signal.processPreKeyBundle(
      userId,
      {
        registrationId: bundle.registration_id,
        identityKey: new Uint8Array(bundle.identity_public_key),
        signedPreKeyId: bundle.signed_pre_key.id,
        signedPreKeyPublic: new Uint8Array(bundle.signed_pre_key.public_key),
        signedPreKeySignature: new Uint8Array(bundle.signed_pre_key.signature),
        preKeyId: bundle.one_time_pre_key?.id,
        preKeyPublic: bundle.one_time_pre_key ? 
          new Uint8Array(bundle.one_time_pre_key.public_key) : undefined
      },
      storedKeys.identityKeyPair,
      storedKeys.registrationId
    );
  }

  async encryptDM(userId: string, message: string): Promise<Uint8Array> {
    const plaintext = new TextEncoder().encode(message);
    const ciphertext = await this.signal.encryptMessage(userId, plaintext);
    return ciphertext.serialize();
  }

  async decryptDM(userId: string, ciphertext: Uint8Array): Promise<string> {
    const plaintext = await this.signal.decryptMessage(userId, ciphertext);
    return new TextDecoder().decode(plaintext);
  }

  async createGroup(groupId: string): Promise<void> {
    const senderKey = await this.senderKeys.createGroupSession(groupId);
    
    // Save sender key locally
    await this.storage.saveSenderKey({
      groupId,
      chainKey: senderKey.chainKey,
      signatureKeyPair: senderKey.signatureKeyPair,
      keyVersion: senderKey.keyVersion
    });

    // Register group with backend
    await fetch(`${this.apiUrl}/api/e2e/group/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({ group_id: groupId })
    });
  }

  async joinGroup(groupId: string): Promise<void> {
    const senderKey = await this.senderKeys.createGroupSession(groupId);
    
    // Save sender key locally
    await this.storage.saveSenderKey({
      groupId,
      chainKey: senderKey.chainKey,
      signatureKeyPair: senderKey.signatureKeyPair,
      keyVersion: senderKey.keyVersion
    });

    // Share sender key with group
    await fetch(`${this.apiUrl}/api/e2e/group/${groupId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({
        chain_key: Array.from(senderKey.chainKey),
        public_signature_key: Array.from(senderKey.signatureKeyPair.publicKey),
        key_version: senderKey.keyVersion
      })
    });

    // Fetch other members' sender keys
    await this.fetchGroupKeys(groupId);
  }

  private async fetchGroupKeys(groupId: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/e2e/group/${groupId}/keys`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch group keys');
    }

    const bundle = await response.json();
    
    // Add member sender keys to session
    for (const senderKey of bundle.sender_keys) {
      this.senderKeys.addMemberSenderKey(
        groupId,
        senderKey.user_id,
        {
          chainKey: new Uint8Array(senderKey.chain_key),
          publicSignatureKey: new Uint8Array(senderKey.public_signature_key),
          keyVersion: senderKey.key_version
        }
      );
    }
  }

  async encryptGroupMessage(groupId: string, message: string): Promise<{
    ciphertext: Uint8Array;
    signature: Uint8Array;
    keyVersion: number;
  }> {
    const plaintext = new TextEncoder().encode(message);
    return await this.senderKeys.encryptGroupMessage(groupId, plaintext);
  }

  async decryptGroupMessage(
    groupId: string,
    senderId: string,
    ciphertext: Uint8Array,
    signature: Uint8Array,
    keyVersion: number
  ): Promise<string> {
    const plaintext = await this.senderKeys.decryptGroupMessage(
      groupId,
      senderId,
      ciphertext,
      signature,
      keyVersion
    );
    return new TextDecoder().decode(plaintext);
  }

  async rotateGroupKeys(groupId: string): Promise<void> {
    const newSenderKey = await this.senderKeys.rotateGroupKeys(groupId);
    
    // Save updated sender key
    await this.storage.saveSenderKey({
      groupId,
      chainKey: newSenderKey.chainKey,
      signatureKeyPair: newSenderKey.signatureKeyPair,
      keyVersion: newSenderKey.keyVersion
    });

    // Notify backend of key rotation
    await fetch(`${this.apiUrl}/api/e2e/group/${groupId}/rekey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({
        chain_key: Array.from(newSenderKey.chainKey),
        public_signature_key: Array.from(newSenderKey.signatureKeyPair.publicKey),
        key_version: newSenderKey.keyVersion
      })
    });
  }
}