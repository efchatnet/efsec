// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
export class E2EStorage {
    constructor() {
        this.dbName = 'efchat-e2e';
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
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
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
    async saveIdentityKeys(keys) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        const transaction = this.db.transaction(['identity'], 'readwrite');
        const store = transaction.objectStore('identity');
        await new Promise((resolve, reject) => {
            const request = store.put({ id: 'main', ...keys });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    async getIdentityKeys() {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        const transaction = this.db.transaction(['identity'], 'readonly');
        const store = transaction.objectStore('identity');
        return new Promise((resolve, reject) => {
            const request = store.get('main');
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    delete result.id;
                    resolve(result);
                }
                else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
    async saveSession(userId, sessionData) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        const transaction = this.db.transaction(['sessions'], 'readwrite');
        const store = transaction.objectStore('sessions');
        await new Promise((resolve, reject) => {
            const request = store.put({ userId, sessionData });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    async getSession(userId) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        const transaction = this.db.transaction(['sessions'], 'readonly');
        const store = transaction.objectStore('sessions');
        return new Promise((resolve, reject) => {
            const request = store.get(userId);
            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.sessionData : null);
            };
            request.onerror = () => reject(request.error);
        });
    }
    async saveSenderKey(senderKey) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        const transaction = this.db.transaction(['senderKeys'], 'readwrite');
        const store = transaction.objectStore('senderKeys');
        await new Promise((resolve, reject) => {
            const request = store.put(senderKey);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    async getSenderKey(groupId) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        const transaction = this.db.transaction(['senderKeys'], 'readonly');
        const store = transaction.objectStore('senderKeys');
        return new Promise((resolve, reject) => {
            const request = store.get(groupId);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
        });
    }
    async clearAll() {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        const stores = ['identity', 'sessions', 'senderKeys', 'preKeys', 'groupSessions'];
        const transaction = this.db.transaction(stores, 'readwrite');
        await Promise.all(stores.map(storeName => {
            return new Promise((resolve, reject) => {
                const request = transaction.objectStore(storeName).clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }));
    }
}
//# sourceMappingURL=indexeddb.js.map