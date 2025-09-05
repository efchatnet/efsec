// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
import { SessionStore, SessionRecord } from '@signalapp/libsignal-client';
export class SessionStoreImpl extends SessionStore {
    constructor() {
        super();
        this.dbName = 'efchat-e2e-sessions';
        this.db = null;
        this.sessions = new Map();
    }
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                this.loadSessionsFromDB().then(resolve).catch(reject);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('sessions')) {
                    db.createObjectStore('sessions', { keyPath: 'id' });
                }
            };
        });
    }
    async loadSessionsFromDB() {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readonly');
            const store = transaction.objectStore('sessions');
            const request = store.getAll();
            request.onsuccess = () => {
                const sessions = request.result;
                sessions.forEach((session) => {
                    this.sessions.set(session.id, new Uint8Array(session.record));
                });
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }
    async saveSessionToDB(id, record) {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');
            const request = store.put({ id, record: Array.from(record) });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    getSessionId(address) {
        return `${address.serviceId()}.${address.deviceId()}`;
    }
    // Implementation of abstract methods from SessionStore
    async saveSession(address, record) {
        const id = this.getSessionId(address);
        const serialized = record.serialize();
        this.sessions.set(id, serialized);
        await this.saveSessionToDB(id, serialized);
    }
    async getSession(address) {
        const id = this.getSessionId(address);
        const serialized = this.sessions.get(id);
        if (!serialized) {
            return null;
        }
        return SessionRecord.deserialize(Buffer.from(serialized));
    }
    async getExistingSessions(addresses) {
        const sessions = [];
        for (const address of addresses) {
            const session = await this.getSession(address);
            if (session) {
                sessions.push(session);
            }
        }
        return sessions;
    }
}
//# sourceMappingURL=SessionStore.js.map