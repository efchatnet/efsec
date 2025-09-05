// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import { PrivateKey } from '@signalapp/libsignal-client';

export class PreKeyStoreImpl {
  private preKeys: Map<number, Uint8Array>;
  private db: IDBDatabase | null = null;
  private dbName = 'efchat-e2e-prekeys';

  constructor() {
    this.preKeys = new Map();
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.loadPreKeysFromDB();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('prekeys')) {
          db.createObjectStore('prekeys', { keyPath: 'id' });
        }
      };
    });
  }

  private async loadPreKeysFromDB(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['prekeys'], 'readonly');
      const store = transaction.objectStore('prekeys');
      const request = store.getAll();

      request.onsuccess = () => {
        const preKeys = request.result;
        preKeys.forEach((preKey: any) => {
          this.preKeys.set(preKey.id, preKey.key);
        });
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async savePreKey(id: number, record: PrivateKey): Promise<void> {
    const serialized = record.serialize();
    this.preKeys.set(id, serialized);

    if (this.db) {
      const transaction = this.db.transaction(['prekeys'], 'readwrite');
      const store = transaction.objectStore('prekeys');
      await new Promise<void>((resolve, reject) => {
        const request = store.put({ id, key: serialized });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  async getPreKey(id: number): Promise<PrivateKey> {
    const serialized = this.preKeys.get(id);
    
    if (!serialized) {
      throw new Error(`PreKey ${id} not found`);
    }
    
    return PrivateKey.deserialize(serialized);
  }

  async removePreKey(id: number): Promise<void> {
    this.preKeys.delete(id);

    if (this.db) {
      const transaction = this.db.transaction(['prekeys'], 'readwrite');
      const store = transaction.objectStore('prekeys');
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  async containsPreKey(id: number): Promise<boolean> {
    return this.preKeys.has(id);
  }

  async getAllPreKeyIds(): Promise<number[]> {
    return Array.from(this.preKeys.keys());
  }

  async countPreKeys(): Promise<number> {
    return this.preKeys.size;
  }
}