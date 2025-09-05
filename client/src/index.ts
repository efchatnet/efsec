// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import { SignalProtocol, SignalKeys } from './protocol/signal';
import { GroupProtocol } from './protocol/groups';
import { KeyDistributionService } from './services/KeyDistributionService';
import { E2EStorage } from './storage/indexeddb';

// Core Protocol exports
export * from './protocol/signal';
export * from './protocol/groups';
export * from './protocol/SignalManager';

// Storage exports
export * from './storage/indexeddb';
export * from './stores';

// Service exports
export * from './services/DMService';
export * from './services/KeyDistributionService';

// Component exports (SolidJS)
export * from './components';

export interface E2EClient {
  signal: SignalProtocol;
  groups: GroupProtocol;
  storage: E2EStorage;
  keyDistribution: KeyDistributionService;
}

export class EfSecClient {
  private signal: SignalProtocol;
  private groups: GroupProtocol;
  private keyDistribution: KeyDistributionService;
  private storage: E2EStorage;
  private apiUrl: string;
  private authToken?: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
    this.signal = new SignalProtocol();
    this.groups = new GroupProtocol(this.signal);
    this.storage = new E2EStorage();
    this.keyDistribution = new KeyDistributionService(
      this.signal,
      this.groups,
      apiUrl
    );
  }

  async init(authToken?: string): Promise<void> {
    this.authToken = authToken;
    this.keyDistribution = new KeyDistributionService(
      this.signal,
      this.groups,
      this.apiUrl,
      authToken
    );
    
    await this.storage.init();
    await this.signal.initialize();
    await this.groups.initialize();
    
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
    // Create group and get our SenderKeyDistributionMessage
    const distributionMessage = await this.groups.createGroup(groupId);
    
    // Register group with backend (server only tracks membership)
    const response = await fetch(`${this.apiUrl}/api/e2e/group/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({ group_id: groupId })
    });

    if (!response.ok) {
      throw new Error('Failed to create group on server');
    }
    
    // Get initial members and distribute our keys to them
    await this.keyDistribution.distributeGroupKeys(groupId, distributionMessage);
  }

  async joinGroup(groupId: string): Promise<void> {
    // Create our SenderKeyDistributionMessage for this group
    const distributionMessage = await this.groups.createGroup(groupId);
    
    // Register with backend (server only tracks membership)
    const response = await fetch(`${this.apiUrl}/api/e2e/group/${groupId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({
        // Server only needs to know we joined, no keys!
      })
    });

    if (!response.ok) {
      throw new Error('Failed to join group on server');
    }
    
    // Distribute our sender key to all existing members via encrypted DMs
    await this.keyDistribution.distributeGroupKeys(groupId, distributionMessage);
    
    // Request sender keys from other members
    await this.keyDistribution.requestGroupKeys(groupId);
  }

  async processIncomingKeyDistribution(
    senderId: string,
    encryptedMessage: Uint8Array
  ): Promise<void> {
    // Process key distribution messages received via encrypted DMs
    await this.keyDistribution.processKeyDistributionMessage(senderId, encryptedMessage);
  }

  async processKeyRequest(
    senderId: string,
    encryptedMessage: Uint8Array
  ): Promise<void> {
    // Process key requests and respond with our keys
    await this.keyDistribution.processKeyRequest(senderId, encryptedMessage);
  }

  async encryptGroupMessage(groupId: string, message: string): Promise<Uint8Array> {
    const plaintext = new TextEncoder().encode(message);
    // Use Signal's group encryption with sender keys
    return await this.groups.encryptGroupMessage(groupId, plaintext);
  }

  async decryptGroupMessage(
    groupId: string,
    senderId: string,
    senderDeviceId: number,
    ciphertext: Uint8Array
  ): Promise<string> {
    // Use Signal's group decryption
    const plaintext = await this.groups.decryptGroupMessage(
      groupId,
      senderId,
      senderDeviceId,
      ciphertext
    );
    return new TextDecoder().decode(plaintext);
  }

  async rotateGroupKeys(groupId: string): Promise<void> {
    // Rotate keys and distribute new keys to all members
    await this.keyDistribution.rotateAndDistributeKeys(groupId);
  }

  async handleMemberRemoval(groupId: string, removedUserId: string): Promise<void> {
    // Handle member removal - rotates keys and redistributes
    await this.keyDistribution.handleMemberRemoval(groupId, removedUserId);
  }

  async handleNewMember(groupId: string, newMemberId: string): Promise<void> {
    // Handle new member joining - exchange keys
    await this.keyDistribution.handleNewMember(groupId, newMemberId);
  }
}