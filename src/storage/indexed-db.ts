/**
 * Copyright (C) 2025 efchat <tj@efchat.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { IdentityKeys, KeyPair, KeyStoreData, SessionState } from '../crypto/types.js';
import { KeyError } from '../crypto/types.js';

const DB_NAME = 'efsec-keystore';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

export class KeyStore {
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    if (this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new KeyError('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('deviceId', 'deviceId', { unique: false });
        }
      };
    });
  }

  async storeIdentityKeys(deviceId: string, identityKeys: IdentityKeys): Promise<void> {
    await this.ensureInitialized();

    return this.performTransaction<void>('readwrite', (store) => {
      store.put({
        id: 'identity-keys',
        deviceId,
        identityKeys,
        updatedAt: Date.now(),
      });
      return undefined;
    });
  }

  async getIdentityKeys(deviceId: string): Promise<IdentityKeys | null> {
    await this.ensureInitialized();

    return this.performTransaction('readonly', (store) => {
      return store.get('identity-keys');
    }).then((result) => {
      if (result && result.deviceId === deviceId) {
        return result.identityKeys;
      }
      return null;
    });
  }

  async storeSignedPreKey(deviceId: string, signedPreKey: KeyPair): Promise<void> {
    await this.ensureInitialized();

    return this.performTransaction<void>('readwrite', (store) => {
      store.put({
        id: 'signed-prekey',
        deviceId,
        signedPreKey,
        updatedAt: Date.now(),
      });
      return undefined;
    });
  }

  async getSignedPreKey(deviceId: string): Promise<KeyPair | null> {
    await this.ensureInitialized();

    return this.performTransaction('readonly', (store) => {
      return store.get('signed-prekey');
    }).then((result) => {
      if (result && result.deviceId === deviceId) {
        return result.signedPreKey;
      }
      return null;
    });
  }

  async storeOneTimePreKeys(deviceId: string, oneTimePreKeys: KeyPair[]): Promise<void> {
    await this.ensureInitialized();

    return this.performTransaction<void>('readwrite', (store) => {
      store.put({
        id: 'one-time-prekeys',
        deviceId,
        oneTimePreKeys,
        updatedAt: Date.now(),
      });
      return undefined;
    });
  }

  async getOneTimePreKeys(deviceId: string): Promise<KeyPair[]> {
    await this.ensureInitialized();

    return this.performTransaction('readonly', (store) => {
      return store.get('one-time-prekeys');
    }).then((result) => {
      if (result && result.deviceId === deviceId) {
        return result.oneTimePreKeys;
      }
      return [];
    });
  }

  async storeSession(sessionId: string, sessionState: SessionState): Promise<void> {
    await this.ensureInitialized();

    return this.performTransaction<void>('readwrite', (store) => {
      store.put({
        id: `session-${sessionId}`,
        sessionId,
        sessionState,
        updatedAt: Date.now(),
      });
      return undefined;
    });
  }

  async getSession(sessionId: string): Promise<SessionState | null> {
    await this.ensureInitialized();

    return this.performTransaction('readonly', (store) => {
      return store.get(`session-${sessionId}`);
    }).then((result) => {
      return result ? result.sessionState : null;
    });
  }

  async getAllSessions(): Promise<Record<string, SessionState>> {
    await this.ensureInitialized();

    return this.performTransaction('readonly', (store) => {
      return store.getAll();
    }).then((results) => {
      const sessions: Record<string, SessionState> = {};
      for (const result of results) {
        if (result.id.startsWith('session-')) {
          sessions[result.sessionId] = result.sessionState;
        }
      }
      return sessions;
    });
  }

  async removeSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();

    return this.performTransaction<void>('readwrite', (store) => {
      store.delete(`session-${sessionId}`);
      return undefined;
    });
  }

  async clearAll(): Promise<void> {
    await this.ensureInitialized();

    return this.performTransaction<void>('readwrite', (store) => {
      store.clear();
      return undefined;
    });
  }

  async exportData(deviceId: string): Promise<KeyStoreData | null> {
    const identityKeys = await this.getIdentityKeys(deviceId);
    const signedPreKey = await this.getSignedPreKey(deviceId);
    const oneTimePreKeys = await this.getOneTimePreKeys(deviceId);
    const sessions = await this.getAllSessions();

    if (!identityKeys || !signedPreKey) {
      return null;
    }

    return {
      identityKeys,
      signedPreKey,
      oneTimePreKeys,
      sessions,
      deviceId,
    };
  }

  async importData(data: KeyStoreData): Promise<void> {
    await this.storeIdentityKeys(data.deviceId, data.identityKeys);
    await this.storeSignedPreKey(data.deviceId, data.signedPreKey);
    await this.storeOneTimePreKeys(data.deviceId, data.oneTimePreKeys);

    for (const [sessionId, sessionState] of Object.entries(data.sessions)) {
      await this.storeSession(sessionId, sessionState);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }
  }

  private async performTransaction<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T> | undefined
  ): Promise<T> {
    if (!this.db) {
      throw new KeyError('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db?.transaction([STORE_NAME], mode);
      if (!transaction) {
        reject(new KeyError('Failed to create transaction'));
        return;
      }

      const store = transaction.objectStore(STORE_NAME);

      transaction.onerror = () => {
        reject(new KeyError('Transaction failed'));
      };

      const request = operation(store);
      if (request) {
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(new KeyError('Operation failed'));
        };
      } else {
        transaction.oncomplete = () => {
          resolve(undefined as T);
        };
      }
    });
  }
}
