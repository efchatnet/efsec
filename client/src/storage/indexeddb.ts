// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

export interface StoredKeys {
  identityKeyPair: Uint8Array;
  registrationId: number;
  signedPreKey: {
    keyId: number;
    keyPair: Uint8Array;
    signature: Uint8Array;
  };
  oneTimePreKeys: Array<{
    keyId: number;
    keyPair: Uint8Array;
  }>;
}

export interface StoredSession {
  userId: string;
  sessionData: Uint8Array;
}

export interface StoredSenderKey {
  groupId: string;
  chainKey: Uint8Array;
  signatureKeyPair: {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
  };
  keyVersion: number;
}

export class E2EStorage {
  private dbName = 'efchat-e2e';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = (): void => reject(request.error);
      request.onsuccess = (): void => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event): void => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Identity keys store
        if (!db.objectStoreNames.contains('identity')) {
          db.createObjectStore('identity', { keyPath: 'id' });
        }

        // Sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessions = db.createObjectStore('sessions', { keyPath: 'userId' });
          sessions.createIndex('userId', 'userId', { unique: true });
        }

        // Sender keys store
        if (!db.objectStoreNames.contains('senderKeys')) {
          const senderKeys = db.createObjectStore('senderKeys', { keyPath: 'groupId' });
          senderKeys.createIndex('groupId', 'groupId', { unique: true });
        }

        // Prekeys store
        if (!db.objectStoreNames.contains('preKeys')) {
          const preKeys = db.createObjectStore('preKeys', { keyPath: 'keyId' });
          preKeys.createIndex('keyId', 'keyId', { unique: true });
        }

        // Group sessions store
        if (!db.objectStoreNames.contains('groupSessions')) {
          const groupSessions = db.createObjectStore('groupSessions', { keyPath: 'groupId' });
          groupSessions.createIndex('groupId', 'groupId', { unique: true });
        }
      };
    });
  }

  async saveIdentityKeys(keys: StoredKeys): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(['identity'], 'readwrite');
    const store = transaction.objectStore('identity');

    await new Promise<void>((resolve, reject) => {
      const request = store.put({ id: 'main', ...keys });
      request.onsuccess = (): void => resolve();
      request.onerror = (): void => reject(request.error);
    });
  }

  async getIdentityKeys(): Promise<StoredKeys | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(['identity'], 'readonly');
    const store = transaction.objectStore('identity');

    return new Promise((resolve, reject) => {
      const request = store.get('main');
      request.onsuccess = (): void => {
        const result = request.result;
        if (result) {
          delete result.id;
          resolve(result as StoredKeys);
        } else {
          resolve(null);
        }
      };
      request.onerror = (): void => reject(request.error);
    });
  }

  async saveSession(userId: string, sessionData: Uint8Array): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');

    await new Promise<void>((resolve, reject) => {
      const request = store.put({ userId, sessionData });
      request.onsuccess = (): void => resolve();
      request.onerror = (): void => reject(request.error);
    });
  }

  async getSession(userId: string): Promise<Uint8Array | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');

    return new Promise((resolve, reject) => {
      const request = store.get(userId);
      request.onsuccess = (): void => {
        const result = request.result;
        resolve(result ? result.sessionData : null);
      };
      request.onerror = (): void => reject(request.error);
    });
  }

  async saveSenderKey(senderKey: StoredSenderKey): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(['senderKeys'], 'readwrite');
    const store = transaction.objectStore('senderKeys');

    await new Promise<void>((resolve, reject) => {
      const request = store.put(senderKey);
      request.onsuccess = (): void => resolve();
      request.onerror = (): void => reject(request.error);
    });
  }

  async getSenderKey(groupId: string): Promise<StoredSenderKey | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(['senderKeys'], 'readonly');
    const store = transaction.objectStore('senderKeys');

    return new Promise((resolve, reject) => {
      const request = store.get(groupId);
      request.onsuccess = (): void => resolve(request.result ?? null);
      request.onerror = (): void => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stores = ['identity', 'sessions', 'senderKeys', 'preKeys', 'groupSessions'];
    const transaction = this.db.transaction(stores, 'readwrite');

    await Promise.all(
      stores.map(storeName => {
        return new Promise<void>((resolve, reject) => {
          const request = transaction.objectStore(storeName).clear();
          request.onsuccess = (): void => resolve();
          request.onerror = (): void => reject(request.error);
        });
      })
    );
  }
}
