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

import { beforeAll, describe, expect, it } from 'vitest';
import {
  KeyStore,
  createInboundSession,
  createOutboundSession,
  decryptMessage,
  encryptMessage,
  generateIdentityKeyPair,
  generateOneTimePreKeys,
  initializeWasm,
} from '../src/index.js';

describe('EfSec Crypto Functions', () => {
  beforeAll(async () => {
    await initializeWasm('@test-user:example.com', 'test-device-1');
  });

  describe('Key Generation', () => {
    it('should generate identity key pair', async () => {
      const identityKeys = await generateIdentityKeyPair();

      expect(identityKeys).toBeDefined();
      expect(identityKeys.curve25519).toBeDefined();
      expect(identityKeys.ed25519).toBeDefined();
      expect(identityKeys.curve25519.key).toBeTypeOf('string');
      expect(identityKeys.ed25519.key).toBeTypeOf('string');
    });


    it('should generate one-time prekeys', async () => {
      const oneTimeKeys = await generateOneTimePreKeys(10);

      expect(oneTimeKeys).toHaveLength(10);
      for (const key of oneTimeKeys) {
        expect(key.publicKey.key).toBeTypeOf('string');
        expect(key.privateKey).toBeTypeOf('string');
      }
    });

    it('should reject invalid one-time key counts', async () => {
      await expect(generateOneTimePreKeys(0)).rejects.toThrow();
      await expect(generateOneTimePreKeys(101)).rejects.toThrow();
    });
  });

  describe('Session Management', () => {
    it('should create outbound session', async () => {
      const aliceIdentity = await generateIdentityKeyPair();
      const bobIdentity = await generateIdentityKeyPair();
      const bobOneTimeKeys = await generateOneTimePreKeys(1);

      const preKeyBundle = {
        identityKey: bobIdentity.curve25519.key,
        oneTimePreKeys: bobOneTimeKeys,
        deviceId: 'bob-device-1',
        userId: 'bob',
      };

      const session = await createOutboundSession(aliceIdentity, preKeyBundle);

      expect(session).toBeDefined();
      expect(session.sessionId).toBeTypeOf('string');
      expect(session.remoteUserId).toBe('bob');
      expect(session.remoteDeviceId).toBe('bob-device-1');
      expect(session.state).toBeDefined();
    });

    it('should create inbound session', async () => {
      const bobIdentity = await generateIdentityKeyPair();
      const aliceIdentity = 'alice-identity-key';
      const prekeyMessage = {};

      const session = await createInboundSession(bobIdentity, aliceIdentity, prekeyMessage);

      expect(session).toBeDefined();
      expect(session.sessionId).toBeTypeOf('string');
      expect(session.state).toBeDefined();
    });
  });

  describe('Message Encryption/Decryption', () => {
    it('should encrypt and decrypt messages', async () => {
      const aliceIdentity = await generateIdentityKeyPair();
      const bobIdentity = await generateIdentityKeyPair();
      const bobOneTimeKeys = await generateOneTimePreKeys(1);

      const preKeyBundle = {
        identityKey: bobIdentity.curve25519.key,
        oneTimePreKeys: bobOneTimeKeys,
        deviceId: 'bob-device-1',
        userId: 'bob',
      };

      const session = await createOutboundSession(aliceIdentity, preKeyBundle);

      const originalMessage = {
        content: 'Hello, Bob!',
        timestamp: Date.now(),
        messageId: 'msg-123',
      };

      const encrypted = await encryptMessage(session, originalMessage);
      expect(encrypted).toBeDefined();
      expect(encrypted.body).toBeTypeOf('string');
      expect(encrypted.sessionId).toBe(session.sessionId);

      const decrypted = await decryptMessage(session, encrypted);
      expect(decrypted).toBeDefined();
      expect(decrypted.content).toBe(originalMessage.content);
    });
  });

  describe('Key Storage', () => {
    it('should store and retrieve identity keys', async () => {
      const keyStore = new KeyStore();
      await keyStore.initialize();

      const deviceId = 'test-device-1';
      const identityKeys = await generateIdentityKeyPair();

      await keyStore.storeIdentityKeys(deviceId, identityKeys);
      const retrieved = await keyStore.getIdentityKeys(deviceId);

      expect(retrieved).toEqual(identityKeys);

      await keyStore.clearAll();
    });

    it('should store and retrieve sessions', async () => {
      const keyStore = new KeyStore();
      await keyStore.initialize();

      const sessionId = 'session-123';
      const sessionState = {
        rootKey: 'test-root-key',
        chainKey: 'test-chain-key',
        nextHeaderKey: 'test-next-header-key',
        headerKey: 'test-header-key',
        messageKeys: {},
        sendingChain: { chainKey: 'test-sending-key', messageNumber: 0 },
        receivingChains: [],
        previousCounter: 0,
      };

      await keyStore.storeSession(sessionId, sessionState);
      const retrieved = await keyStore.getSession(sessionId);

      expect(retrieved).toEqual(sessionState);

      await keyStore.clearAll();
    });

    it('should export and import data', async () => {
      const keyStore = new KeyStore();
      await keyStore.initialize();

      const deviceId = 'test-device-1';
      const identityKeys = await generateIdentityKeyPair();
      const oneTimePreKeys = await generateOneTimePreKeys(5);

      await keyStore.storeIdentityKeys(deviceId, identityKeys);
      await keyStore.storeOneTimePreKeys(deviceId, oneTimePreKeys);

      const exported = await keyStore.exportData(deviceId);
      expect(exported).toBeDefined();
      expect(exported?.deviceId).toBe(deviceId);

      await keyStore.clearAll();

      if (exported) {
        await keyStore.importData(exported);
      }
      const retrievedIdentity = await keyStore.getIdentityKeys(deviceId);
      expect(retrievedIdentity).toEqual(identityKeys);

      await keyStore.clearAll();
    });
  });
});
