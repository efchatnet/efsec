// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import { PrivateKey } from '@signalapp/libsignal-client';

interface SignedPreKeyRecord {
  id: number;
  key: Uint8Array;
  signature: Uint8Array;
  timestamp: number;
}

export class SignedPreKeyStoreImpl {
  private signedPreKeys: Map<number, SignedPreKeyRecord>;
  private db: IDBDatabase | null = null;
  private dbName = 'efchat-e2e-signed-prekeys';

  constructor() {
    this.signedPreKeys = new Map();
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.loadSignedPreKeysFromDB();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('signedprekeys')) {
          const store = db.createObjectStore('signedprekeys', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  private async loadSignedPreKeysFromDB(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['signedprekeys'], 'readonly');
      const store = transaction.objectStore('signedprekeys');
      const request = store.getAll();

      request.onsuccess = () => {
        const signedPreKeys = request.result;
        signedPreKeys.forEach((spk: SignedPreKeyRecord) => {
          this.signedPreKeys.set(spk.id, spk);
        });
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async saveSignedPreKey(
    id: number, 
    record: PrivateKey, 
    signature: Uint8Array
  ): Promise<void> {
    const serialized = record.serialize();
    const signedPreKeyRecord: SignedPreKeyRecord = {
      id,
      key: serialized,
      signature,
      timestamp: Date.now()
    };
    
    this.signedPreKeys.set(id, signedPreKeyRecord);

    if (this.db) {
      const transaction = this.db.transaction(['signedprekeys'], 'readwrite');
      const store = transaction.objectStore('signedprekeys');
      await new Promise<void>((resolve, reject) => {
        const request = store.put(signedPreKeyRecord);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  async getSignedPreKey(id: number): Promise<PrivateKey> {
    const record = this.signedPreKeys.get(id);
    
    if (!record) {
      throw new Error(`SignedPreKey ${id} not found`);
    }
    
    return PrivateKey.deserialize(record.key);
  }

  async getSignedPreKeySignature(id: number): Promise<Uint8Array> {
    const record = this.signedPreKeys.get(id);
    
    if (!record) {
      throw new Error(`SignedPreKey ${id} not found`);
    }
    
    return record.signature;
  }

  async containsSignedPreKey(id: number): Promise<boolean> {
    return this.signedPreKeys.has(id);
  }

  async removeSignedPreKey(id: number): Promise<void> {
    this.signedPreKeys.delete(id);

    if (this.db) {
      const transaction = this.db.transaction(['signedprekeys'], 'readwrite');
      const store = transaction.objectStore('signedprekeys');
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  async getAllSignedPreKeyIds(): Promise<number[]> {
    return Array.from(this.signedPreKeys.keys());
  }

  async getOldestSignedPreKey(): Promise<number | null> {
    let oldestId: number | null = null;
    let oldestTimestamp = Infinity;

    this.signedPreKeys.forEach((record, id) => {
      if (record.timestamp < oldestTimestamp) {
        oldestTimestamp = record.timestamp;
        oldestId = id;
      }
    });

    return oldestId;
  }

  async removeOldSignedPreKeys(keepCount: number = 3): Promise<void> {
    const sortedKeys = Array.from(this.signedPreKeys.entries())
      .sort((a, b) => b[1].timestamp - a[1].timestamp);

    // Keep the most recent ones
    const toRemove = sortedKeys.slice(keepCount);

    for (const [id] of toRemove) {
      await this.removeSignedPreKey(id);
    }
  }
}