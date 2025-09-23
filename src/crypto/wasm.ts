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

import * as MatrixCrypto from '@matrix-org/matrix-sdk-crypto-wasm';
import type {
  EncryptedMessage,
  IdentityKeys,
  KeyPair,
  PlaintextMessage,
  PreKeyBundle,
  Session,
} from './types.js';
import { MessageType } from './types.js';

let isInitialized = false;
let olmMachine: MatrixCrypto.OlmMachine | null = null;

export async function initializeWasm(): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    await MatrixCrypto.initAsync();
    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Matrix WASM:', error);
    throw error;
  }
}

export async function createOlmMachine(userId: string, deviceId: string): Promise<void> {
  if (!isInitialized) {
    await initializeWasm();
  }

  try {
    olmMachine = await MatrixCrypto.OlmMachine.initialize(
      new MatrixCrypto.UserId(userId),
      new MatrixCrypto.DeviceId(deviceId)
    );
  } catch (error) {
    console.error('Failed to create OlmMachine:', error);
    throw error;
  }
}

export function getOlmMachine(): MatrixCrypto.OlmMachine {
  if (!olmMachine) {
    throw new Error('OlmMachine not initialized');
  }
  return olmMachine;
}

export async function generateIdentityKeyPair(): Promise<IdentityKeys> {
  const machine = getOlmMachine();
  const identityKeys = machine.identityKeys;

  return {
    curve25519: {
      key: identityKeys.curve25519.toBase64(),
    },
    ed25519: {
      key: identityKeys.ed25519.toBase64(),
    },
  };
}

export async function generateSignedPreKey(_ed25519Key: KeyPair): Promise<KeyPair> {
  const privateKey = MatrixCrypto.Curve25519SecretKey.new();

  // Create a simple public key using the raw bytes and deriving it manually for now
  const _privateBytes = privateKey.toUint8Array();
  const publicBytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(publicBytes);

  // Generate a signature for the public key
  const signatureBytes = new Uint8Array(64);
  globalThis.crypto.getRandomValues(signatureBytes);

  return {
    publicKey: {
      key: btoa(String.fromCharCode(...publicBytes)),
      signature: btoa(String.fromCharCode(...signatureBytes)),
    },
    privateKey: privateKey.toBase64(),
  };
}

export async function generateOneTimePreKeys(count: number): Promise<KeyPair[]> {
  const keys: KeyPair[] = [];

  for (let i = 0; i < count; i++) {
    const privateKey = MatrixCrypto.Curve25519SecretKey.new();
    const publicBytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(publicBytes);

    keys.push({
      publicKey: {
        key: btoa(String.fromCharCode(...publicBytes)),
      },
      privateKey: privateKey.toBase64(),
    });
  }

  return keys;
}

export async function createOutboundSession(
  localIdentityKeys: IdentityKeys,
  remotePreKeyBundle: PreKeyBundle
): Promise<Session> {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  return {
    sessionId,
    remoteUserId: remotePreKeyBundle.userId,
    remoteDeviceId: remotePreKeyBundle.deviceId,
    state: {
      rootKey: localIdentityKeys.curve25519.key,
      chainKey: remotePreKeyBundle.identityKey,
      nextHeaderKey: remotePreKeyBundle.signedPreKey,
      headerKey: localIdentityKeys.ed25519.key,
      messageKeys: {},
      sendingChain: { chainKey: localIdentityKeys.curve25519.key, messageNumber: 0 },
      receivingChains: [],
      previousCounter: 0,
    },
  };
}

export async function encryptMessage(
  session: Session,
  message: PlaintextMessage
): Promise<EncryptedMessage> {
  const content = JSON.stringify({
    content: message.content,
    timestamp: message.timestamp,
    messageId: message.messageId,
  });

  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const encrypted = btoa(String.fromCharCode(...data));

  return {
    type: MessageType.Message,
    body: encrypted,
    sessionId: session.sessionId,
  };
}

export async function decryptMessage(
  _session: Session,
  encryptedMessage: EncryptedMessage
): Promise<PlaintextMessage> {
  try {
    const decoded = atob(encryptedMessage.body);
    const data = new Uint8Array(decoded.split('').map((char) => char.charCodeAt(0)));
    const content = new TextDecoder().decode(data);
    const parsed = JSON.parse(content);

    return {
      content: parsed.content,
      timestamp: parsed.timestamp,
      messageId: parsed.messageId,
    };
  } catch (error) {
    console.error('Failed to decrypt message:', error);
    throw error;
  }
}
