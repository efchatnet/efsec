"use strict";
// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityKeyStoreImpl = void 0;
const libsignal_client_1 = require("@signalapp/libsignal-client");
class IdentityKeyStoreImpl extends libsignal_client_1.IdentityKeyStore {
    constructor() {
        super();
        this.identityKey = null;
        this.registrationId = null;
        this.dbName = 'efchat-e2e-identity';
        this.db = null;
        this.trustedIdentities = new Map();
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
                if (!db.objectStoreNames.contains('identity')) {
                    db.createObjectStore('identity', { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains('trustedIdentities')) {
                    db.createObjectStore('trustedIdentities', { keyPath: 'id' });
                }
            };
        });
    }
    async loadFromDB() {
        if (!this.db)
            return;
        // Load identity key and registration ID
        const identityData = await this.loadIdentityFromDB();
        if (identityData) {
            this.identityKey = libsignal_client_1.PrivateKey.deserialize(Buffer.from(identityData.privateKey));
            this.registrationId = identityData.registrationId;
        }
        // Load trusted identities
        await this.loadTrustedIdentitiesFromDB();
    }
    async loadIdentityFromDB() {
        if (!this.db)
            return null;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['identity'], 'readonly');
            const store = transaction.objectStore('identity');
            const request = store.get('identity');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    async loadTrustedIdentitiesFromDB() {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['trustedIdentities'], 'readonly');
            const store = transaction.objectStore('trustedIdentities');
            const request = store.getAll();
            request.onsuccess = () => {
                const identities = request.result;
                identities.forEach((identity) => {
                    this.trustedIdentities.set(identity.id, new Uint8Array(identity.publicKey));
                });
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }
    async setIdentityKeyPair(privateKey, registrationId) {
        this.identityKey = privateKey;
        this.registrationId = registrationId;
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['identity'], 'readwrite');
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
    getIdentityId(address) {
        return `${address.serviceId()}.${address.deviceId()}`;
    }
    // Implementation of abstract methods from IdentityKeyStore
    async getIdentityKey() {
        if (!this.identityKey) {
            throw new Error('Identity key not initialized');
        }
        return this.identityKey;
    }
    async getLocalRegistrationId() {
        if (this.registrationId === null) {
            throw new Error('Registration ID not initialized');
        }
        return this.registrationId;
    }
    async saveIdentity(address, key) {
        const id = this.getIdentityId(address);
        const serialized = key.serialize();
        // Check if we already have a different key for this address
        const existing = this.trustedIdentities.get(id);
        const changed = !existing || !Buffer.from(existing).equals(serialized);
        this.trustedIdentities.set(id, serialized);
        // Persist to IndexedDB
        if (this.db) {
            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['trustedIdentities'], 'readwrite');
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
        if (!existing || !changed) {
            return libsignal_client_1.IdentityChange.NewOrUnchanged;
        }
        else {
            return libsignal_client_1.IdentityChange.ReplacedExisting;
        }
    }
    async isTrustedIdentity(address, key, _direction) {
        const id = this.getIdentityId(address);
        const trusted = this.trustedIdentities.get(id);
        if (!trusted) {
            // First time seeing this identity, trust it
            return true;
        }
        // Check if the key matches what we have stored
        return Buffer.from(trusted).equals(key.serialize());
    }
    async getIdentity(address) {
        const id = this.getIdentityId(address);
        const serialized = this.trustedIdentities.get(id);
        if (!serialized) {
            return null;
        }
        return libsignal_client_1.PublicKey.deserialize(Buffer.from(serialized));
    }
}
exports.IdentityKeyStoreImpl = IdentityKeyStoreImpl;
//# sourceMappingURL=IdentityKeyStore.js.map