// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
import { KyberPreKeyStore, KyberPreKeyRecord } from '@signalapp/libsignal-client';
export class KyberPreKeyStoreImpl extends KyberPreKeyStore {
    constructor() {
        super(...arguments);
        this.kyberPreKeys = new Map();
        this.dbName = 'SignalKyberPreKeyStore';
        this.storeName = 'kyberPreKeys';
        this.db = null;
    }
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    }
    async saveKyberPreKey(keyId, record) {
        this.kyberPreKeys.set(keyId, record);
        if (this.db) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.put({
                    id: keyId,
                    record: record.serialize()
                });
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        }
    }
    async getKyberPreKey(keyId) {
        // Try memory first
        const cached = this.kyberPreKeys.get(keyId);
        if (cached) {
            return cached;
        }
        // Try IndexedDB
        if (this.db) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(keyId);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    if (request.result) {
                        try {
                            const record = KyberPreKeyRecord.deserialize(Buffer.from(request.result.record));
                            this.kyberPreKeys.set(keyId, record);
                            resolve(record);
                        }
                        catch (err) {
                            reject(err);
                        }
                    }
                    else {
                        reject(new Error(`Kyber prekey ${keyId} not found`));
                    }
                };
            });
        }
        throw new Error(`Kyber prekey ${keyId} not found`);
    }
    async markKyberPreKeyUsed(keyId) {
        // Remove from memory
        this.kyberPreKeys.delete(keyId);
        // Remove from IndexedDB
        if (this.db) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.delete(keyId);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        }
    }
    async countKyberPreKeys() {
        if (this.db) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.count();
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
            });
        }
        return this.kyberPreKeys.size;
    }
}
//# sourceMappingURL=KyberPreKeyStore.js.map