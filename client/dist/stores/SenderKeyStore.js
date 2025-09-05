"use strict";
// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SenderKeyStoreImpl = void 0;
const libsignal_client_1 = require("@signalapp/libsignal-client");
class SenderKeyStoreImpl extends libsignal_client_1.SenderKeyStore {
    constructor() {
        super();
        this.db = null;
        this.dbName = 'efchat-e2e-senderkeys';
        this.senderKeys = new Map();
    }
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                this.loadSenderKeysFromDB().then(resolve).catch(reject);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('senderkeys')) {
                    db.createObjectStore('senderkeys', { keyPath: 'id' });
                }
            };
        });
    }
    async loadSenderKeysFromDB() {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['senderkeys'], 'readonly');
            const store = transaction.objectStore('senderkeys');
            const request = store.getAll();
            request.onsuccess = () => {
                const senderKeys = request.result;
                senderKeys.forEach((key) => {
                    this.senderKeys.set(key.id, new Uint8Array(key.record));
                });
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }
    getSenderKeyId(sender, distributionId) {
        return `${sender.serviceId()}.${sender.deviceId()}::${distributionId.toString()}`;
    }
    async saveSenderKey(sender, distributionId, record) {
        const id = this.getSenderKeyId(sender, distributionId);
        const serialized = record.serialize();
        this.senderKeys.set(id, serialized);
        if (this.db) {
            const transaction = this.db.transaction(['senderkeys'], 'readwrite');
            const store = transaction.objectStore('senderkeys');
            await new Promise((resolve, reject) => {
                const request = store.put({ id, record: Array.from(serialized) });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }
    async getSenderKey(sender, distributionId) {
        const id = this.getSenderKeyId(sender, distributionId);
        const serialized = this.senderKeys.get(id);
        if (!serialized) {
            return null;
        }
        return libsignal_client_1.SenderKeyRecord.deserialize(Buffer.from(serialized));
    }
    async removeSenderKey(sender, distributionId) {
        const id = this.getSenderKeyId(sender, distributionId);
        this.senderKeys.delete(id);
        if (this.db) {
            const transaction = this.db.transaction(['senderkeys'], 'readwrite');
            const store = transaction.objectStore('senderkeys');
            await new Promise((resolve, reject) => {
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }
    async removeAllSenderKeysForDistribution(distributionId) {
        const distributionIdStr = distributionId.toString();
        const keysToRemove = [];
        // Find all keys for this distribution
        this.senderKeys.forEach((_, key) => {
            if (key.endsWith(`::${distributionIdStr}`)) {
                keysToRemove.push(key);
            }
        });
        // Remove from memory
        keysToRemove.forEach(key => this.senderKeys.delete(key));
        // Remove from DB
        if (this.db && keysToRemove.length > 0) {
            const transaction = this.db.transaction(['senderkeys'], 'readwrite');
            const store = transaction.objectStore('senderkeys');
            for (const key of keysToRemove) {
                await new Promise((resolve, reject) => {
                    const request = store.delete(key);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }
        }
    }
}
exports.SenderKeyStoreImpl = SenderKeyStoreImpl;
//# sourceMappingURL=SenderKeyStore.js.map