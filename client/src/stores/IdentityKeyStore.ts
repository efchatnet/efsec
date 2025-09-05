// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import { 
  PrivateKey, 
  PublicKey, 
  ProtocolAddress,
  Direction 
} from '@signalapp/libsignal-client';

interface IdentityRecord {
  identityKey: Uint8Array;
  registrationId: number;
  trustLevel: number;
  timestamp: number;
}

export class IdentityKeyStoreImpl {
  private identityKeyPair: { privateKey: Uint8Array; publicKey: Uint8Array } | null = null;
  private localRegistrationId: number | null = null;
  private trustedIdentities: Map<string, IdentityRecord>;
  private db: IDBDatabase | null = null;
  private dbName = 'efchat-e2e-identity';

  constructor() {
    this.trustedIdentities = new Map();
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.loadIdentitiesFromDB();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('identity')) {
          db.createObjectStore('identity', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('trusted')) {
          db.createObjectStore('trusted', { keyPath: 'address' });
        }
      };
    });
  }

  private async loadIdentitiesFromDB(): Promise<void> {
    if (!this.db) return;

    // Load our identity
    const transaction = this.db.transaction(['identity'], 'readonly');
    const store = transaction.objectStore('identity');
    const request = store.get('local');

    request.onsuccess = () => {
      if (request.result) {
        this.identityKeyPair = request.result.keyPair;
        this.localRegistrationId = request.result.registrationId;
      }
    };

    // Load trusted identities
    const trustedTransaction = this.db.transaction(['trusted'], 'readonly');
    const trustedStore = trustedTransaction.objectStore('trusted');
    const trustedRequest = trustedStore.getAll();

    trustedRequest.onsuccess = () => {
      const identities = trustedRequest.result;
      identities.forEach((identity: any) => {
        this.trustedIdentities.set(identity.address, identity);
      });
    };
  }

  async getIdentityKeyPair(): Promise<{ privateKey: PrivateKey; publicKey: PublicKey }> {
    if (!this.identityKeyPair) {
      throw new Error('Identity key pair not initialized');
    }
    
    return {
      privateKey: PrivateKey.deserialize(this.identityKeyPair.privateKey),
      publicKey: PublicKey.deserialize(this.identityKeyPair.publicKey)
    };
  }

  async getLocalRegistrationId(): Promise<number> {
    if (this.localRegistrationId === null) {
      throw new Error('Registration ID not initialized');
    }
    return this.localRegistrationId;
  }

  async saveIdentity(address: ProtocolAddress, identity: PublicKey): Promise<boolean> {
    const addressKey = `${address.name()}.${address.deviceId()}`;
    const identityBytes = identity.serialize();
    
    // Check if we have an existing identity
    const existing = this.trustedIdentities.get(addressKey);
    
    const identityRecord: IdentityRecord = {
      identityKey: identityBytes,
      registrationId: 0, // Will be set during X3DH
      trustLevel: 0,
      timestamp: Date.now()
    };
    
    this.trustedIdentities.set(addressKey, identityRecord);
    
    // Save to IndexedDB
    if (this.db) {
      const transaction = this.db.transaction(['trusted'], 'readwrite');
      const store = transaction.objectStore('trusted');
      await new Promise<void>((resolve, reject) => {
        const request = store.put({
          address: addressKey,
          ...identityRecord
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
    
    // Return true if this was a new identity or it changed
    return !existing || 
           Buffer.compare(Buffer.from(existing.identityKey), Buffer.from(identityBytes)) !== 0;
  }

  async isTrustedIdentity(
    address: ProtocolAddress,
    identity: PublicKey,
    direction: Direction
  ): Promise<boolean> {
    const addressKey = `${address.name()}.${address.deviceId()}`;
    const trusted = this.trustedIdentities.get(addressKey);
    
    if (!trusted) {
      // First time seeing this identity, trust on first use (TOFU)
      return true;
    }
    
    // Check if the identity matches what we have stored
    const identityBytes = identity.serialize();
    return Buffer.compare(Buffer.from(trusted.identityKey), Buffer.from(identityBytes)) === 0;
  }

  async getIdentity(address: ProtocolAddress): Promise<PublicKey | null> {
    const addressKey = `${address.name()}.${address.deviceId()}`;
    const identity = this.trustedIdentities.get(addressKey);
    
    if (!identity) {
      return null;
    }
    
    return PublicKey.deserialize(identity.identityKey);
  }

  async saveIdentityKeyPair(privateKey: PrivateKey, publicKey: PublicKey): Promise<void> {
    this.identityKeyPair = {
      privateKey: privateKey.serialize(),
      publicKey: publicKey.serialize()
    };

    if (this.db) {
      const transaction = this.db.transaction(['identity'], 'readwrite');
      const store = transaction.objectStore('identity');
      await new Promise<void>((resolve, reject) => {
        const request = store.put({
          id: 'local',
          keyPair: this.identityKeyPair,
          registrationId: this.localRegistrationId
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  async saveLocalRegistrationId(registrationId: number): Promise<void> {
    this.localRegistrationId = registrationId;

    if (this.db) {
      const transaction = this.db.transaction(['identity'], 'readwrite');
      const store = transaction.objectStore('identity');
      await new Promise<void>((resolve, reject) => {
        const request = store.put({
          id: 'local',
          keyPair: this.identityKeyPair,
          registrationId: this.localRegistrationId
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
}