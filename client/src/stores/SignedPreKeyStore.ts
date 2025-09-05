// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import {
  SignedPreKeyStore,
  SignedPreKeyRecord
} from '@signalapp/libsignal-client';

export class SignedPreKeyStoreImpl extends SignedPreKeyStore {
  private signedPreKeys: Map<number, Uint8Array>;
  private dbName = 'efchat-e2e-signed-prekeys';
  private db: IDBDatabase | null = null;

  constructor() {
    super();
    this.signedPreKeys = new Map();
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
        if (!db.objectStoreNames.contains('signedPreKeys')) {
          db.createObjectStore('signedPreKeys', { keyPath: 'id' });
        }
      };
    });
  }

  private async loadFromDB(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['signedPreKeys'], 'readonly');
      const store = transaction.objectStore('signedPreKeys');
      const request = store.getAll();

      request.onsuccess = () => {
        const signedPreKeys = request.result;
        signedPreKeys.forEach((signedPreKey: any) => {
          this.signedPreKeys.set(signedPreKey.id, new Uint8Array(signedPreKey.record));
        });
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async saveSignedPreKeyToDB(id: number, record: Uint8Array): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['signedPreKeys'], 'readwrite');
      const store = transaction.objectStore('signedPreKeys');
      const request = store.put({ id, record: Array.from(record) });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Implementation of abstract methods from SignedPreKeyStore

  async saveSignedPreKey(id: number, record: SignedPreKeyRecord): Promise<void> {
    const serialized = record.serialize();
    this.signedPreKeys.set(id, serialized);
    await this.saveSignedPreKeyToDB(id, serialized);
  }

  async getSignedPreKey(id: number): Promise<SignedPreKeyRecord> {
    const serialized = this.signedPreKeys.get(id);
    
    if (!serialized) {
      throw new Error(`SignedPreKey ${id} not found`);
    }
    
    return SignedPreKeyRecord.deserialize(Buffer.from(serialized));
  }

  // Helper methods
  async containsSignedPreKey(id: number): Promise<boolean> {
    return this.signedPreKeys.has(id);
  }

  async removeSignedPreKey(id: number): Promise<void> {
    this.signedPreKeys.delete(id);
    
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['signedPreKeys'], 'readwrite');
      const store = transaction.objectStore('signedPreKeys');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllSignedPreKeyIds(): Promise<number[]> {
    return Array.from(this.signedPreKeys.keys());
  }
}