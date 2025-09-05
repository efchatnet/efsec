// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
import { PreKeyStore, PreKeyRecord } from '@signalapp/libsignal-client';
export class PreKeyStoreImpl extends PreKeyStore {
    constructor() {
        super();
        this.dbName = 'efchat-e2e-prekeys';
        this.db = null;
        this.preKeys = new Map();
    }
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                this.loadFromDB().then(resolve).catch(reject);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('preKeys')) {
                    db.createObjectStore('preKeys', { keyPath: 'id' });
                }
            };
        });
    }
    async loadFromDB() {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['preKeys'], 'readonly');
            const store = transaction.objectStore('preKeys');
            const request = store.getAll();
            request.onsuccess = () => {
                const preKeys = request.result;
                preKeys.forEach((preKey) => {
                    this.preKeys.set(preKey.id, new Uint8Array(preKey.record));
                });
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }
    async savePreKeyToDB(id, record) {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['preKeys'], 'readwrite');
            const store = transaction.objectStore('preKeys');
            const request = store.put({ id, record: Array.from(record) });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    async removePreKeyFromDB(id) {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['preKeys'], 'readwrite');
            const store = transaction.objectStore('preKeys');
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    // Implementation of abstract methods from PreKeyStore
    async savePreKey(id, record) {
        const serialized = record.serialize();
        this.preKeys.set(id, serialized);
        await this.savePreKeyToDB(id, serialized);
    }
    async getPreKey(id) {
        const serialized = this.preKeys.get(id);
        if (!serialized) {
            throw new Error(`PreKey ${id} not found`);
        }
        return PreKeyRecord.deserialize(Buffer.from(serialized));
    }
    async removePreKey(id) {
        this.preKeys.delete(id);
        await this.removePreKeyFromDB(id);
    }
    // Helper methods
    async containsPreKey(id) {
        return this.preKeys.has(id);
    }
    async getAllPreKeyIds() {
        return Array.from(this.preKeys.keys());
    }
    async countPreKeys() {
        return this.preKeys.size;
    }
}
//# sourceMappingURL=PreKeyStore.js.map