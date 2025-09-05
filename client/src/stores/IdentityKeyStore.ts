// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import {
  IdentityKeyStore,
  PrivateKey,
  PublicKey,
  ProtocolAddress,
  Direction
} from '@signalapp/libsignal-client';

export class IdentityKeyStoreImpl extends IdentityKeyStore {
  private identityKey: PrivateKey | null = null;
  private registrationId: number | null = null;
  private trustedIdentities: Map<string, Uint8Array>;
  private dbName = 'efchat-e2e-identity';
  private db: IDBDatabase | null = null;

  constructor() {
    super();
    this.trustedIdentities = new Map();
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.loadFromDB().then(resolve).catch(reject);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('identity')) {
          db.createObjectStore('identity', { keyPath: 'key' });
        }
        
        if (!db.objectStoreNames.contains('trustedIdentities')) {
          db.createObjectStore('trustedIdentities', { keyPath: 'id' });
        }
      };
    });
  }

  private async loadFromDB(): Promise<void> {
    if (!this.db) return;

    // Load identity key and registration ID
    const identityData = await this.loadIdentityFromDB();
    if (identityData) {
      this.identityKey = PrivateKey.deserialize(Buffer.from(identityData.privateKey));
      this.registrationId = identityData.registrationId;
    }

    // Load trusted identities
    await this.loadTrustedIdentitiesFromDB();
  }

  private async loadIdentityFromDB(): Promise<any> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['identity'], 'readonly');
      const store = transaction.objectStore('identity');
      const request = store.get('identity');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async loadTrustedIdentitiesFromDB(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['trustedIdentities'], 'readonly');
      const store = transaction.objectStore('trustedIdentities');
      const request = store.getAll();

      request.onsuccess = () => {
        const identities = request.result;
        identities.forEach((identity: any) => {
          this.trustedIdentities.set(identity.id, new Uint8Array(identity.publicKey));
        });
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async setIdentityKeyPair(privateKey: PrivateKey, registrationId: number): Promise<void> {
    this.identityKey = privateKey;
    this.registrationId = registrationId;

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['identity'], 'readwrite');
      const store = transaction.objectStore('identity');
      
      const request = store.put({
        key: 'identity',
        privateKey: Array.from(privateKey.serialize()),
        registrationId: registrationId
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private getIdentityId(address: ProtocolAddress): string {
    return `${address.serviceId()}.${address.deviceId()}`;
  }

  // Implementation of abstract methods from IdentityKeyStore

  async getIdentityKey(): Promise<PrivateKey> {
    if (!this.identityKey) {
      throw new Error('Identity key not initialized');
    }
    return this.identityKey;
  }

  async getLocalRegistrationId(): Promise<number> {
    if (this.registrationId === null) {
      throw new Error('Registration ID not initialized');
    }
    return this.registrationId;
  }

  async saveIdentity(address: ProtocolAddress, key: PublicKey): Promise<IdentityKeyStore.IdentityChange> {
    const id = this.getIdentityId(address);
    const serialized = key.serialize();
    
    // Check if we already have a different key for this address
    const existing = this.trustedIdentities.get(id);
    const changed = !existing || !Buffer.from(existing).equals(serialized);
    
    this.trustedIdentities.set(id, serialized);
    
    // Persist to IndexedDB
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction(['trustedIdentities'], 'readwrite');
        const store = transaction.objectStore('trustedIdentities');
        
        const request = store.put({
          id,
          publicKey: Array.from(serialized)
        });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
    
    // Return the appropriate IdentityChange value
    if (!existing) {
      return IdentityKeyStore.IdentityChange.NewIdentity;
    } else if (changed) {
      return IdentityKeyStore.IdentityChange.IdentityChanged;
    } else {
      return IdentityKeyStore.IdentityChange.NoChange;
    }
  }

  async isTrustedIdentity(
    address: ProtocolAddress,
    key: PublicKey,
    _direction: Direction
  ): Promise<boolean> {
    const id = this.getIdentityId(address);
    const trusted = this.trustedIdentities.get(id);
    
    if (!trusted) {
      // First time seeing this identity, trust it
      return true;
    }
    
    // Check if the key matches what we have stored
    return Buffer.from(trusted).equals(key.serialize());
  }

  async getIdentity(address: ProtocolAddress): Promise<PublicKey | null> {
    const id = this.getIdentityId(address);
    const serialized = this.trustedIdentities.get(id);
    
    if (!serialized) {
      return null;
    }
    
    return PublicKey.deserialize(Buffer.from(serialized));
  }
}