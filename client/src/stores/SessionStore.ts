// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import { SessionRecord, ProtocolAddress } from '@signalapp/libsignal-client';

export class SessionStoreImpl {
  private sessions: Map<string, Uint8Array>;
  private dbName = 'efchat-e2e-sessions';
  private db: IDBDatabase | null = null;

  constructor() {
    this.sessions = new Map();
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.loadSessionsFromDB();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
      };
    });
  }

  private async loadSessionsFromDB(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.getAll();

      request.onsuccess = () => {
        const sessions = request.result;
        sessions.forEach((session: any) => {
          this.sessions.set(session.id, session.record);
        });
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async saveSessionToDB(id: string, record: Uint8Array): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.put({ id, record });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveSession(address: ProtocolAddress, record: SessionRecord): Promise<void> {
    const id = `${address.name()}.${address.deviceId()}`;
    const serialized = record.serialize();
    
    this.sessions.set(id, serialized);
    await this.saveSessionToDB(id, serialized);
  }

  async getSession(address: ProtocolAddress): Promise<SessionRecord | null> {
    const id = `${address.name()}.${address.deviceId()}`;
    const serialized = this.sessions.get(id);
    
    if (!serialized) {
      return null;
    }
    
    return SessionRecord.deserialize(serialized);
  }

  async getExistingSessions(addresses: ProtocolAddress[]): Promise<SessionRecord[]> {
    const sessions: SessionRecord[] = [];
    
    for (const address of addresses) {
      const session = await this.getSession(address);
      if (session) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }
}