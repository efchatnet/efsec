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
  OneTimeKey,
  ClaimedOneTimeKey,
} from './types.js';
import { MessageType } from './types.js';

let isInitialized = false;
let olmMachine: MatrixCrypto.OlmMachine | null = null;
let currentUserId: string | null = null;
let currentDeviceId: string | null = null;

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
    currentUserId = userId;
    currentDeviceId = deviceId;
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

export async function generateOneTimeKeys(count: number): Promise<OneTimeKey[]> {
  const machine = getOlmMachine();

  await machine.generateOneTimeKeys(count);
  const oneTimeKeys = machine.oneTimeKeys();

  const keys: OneTimeKey[] = [];
  for (const [keyId, key] of oneTimeKeys.curve25519) {
    keys.push({
      id: keyId,
      key: key.toBase64(),
    });
  }

  return keys;
}

export async function markKeysAsPublished(): Promise<void> {
  const machine = getOlmMachine();
  await machine.markKeysAsPublished();
}

export async function updateTrackedUsers(userIds: string[]): Promise<void> {
  const machine = getOlmMachine();
  const matrixUserIds = userIds.map(id => new MatrixCrypto.UserId(id));
  await machine.updateTrackedUsers(matrixUserIds);
}

export async function getMissingSessions(userId: string): Promise<string[]> {
  const machine = getOlmMachine();
  const matrixUserId = new MatrixCrypto.UserId(userId);
  const missingDevices = await machine.getMissingSessions([matrixUserId]);

  const deviceIds: string[] = [];
  for (const [_, devices] of missingDevices) {
    for (const deviceId of devices) {
      deviceIds.push(deviceId.toString());
    }
  }

  return deviceIds;
}

export async function createOutboundSessions(
  userId: string,
  deviceId: string,
  identityKey: string,
  oneTimeKey: ClaimedOneTimeKey
): Promise<void> {
  const machine = getOlmMachine();

  const matrixUserId = new MatrixCrypto.UserId(userId);
  const matrixDeviceId = new MatrixCrypto.DeviceId(deviceId);
  const matrixIdentityKey = new MatrixCrypto.Curve25519PublicKey(identityKey);
  const matrixOneTimeKey = new MatrixCrypto.Curve25519PublicKey(oneTimeKey.key);

  const oneTimeKeyMap = new Map();
  oneTimeKeyMap.set(oneTimeKey.id, matrixOneTimeKey);

  const deviceKeys = new Map();
  deviceKeys.set(matrixDeviceId, matrixIdentityKey);

  const userDeviceKeys = new Map();
  userDeviceKeys.set(matrixUserId, deviceKeys);

  const oneTimeKeysByUser = new Map();
  const oneTimeKeysByDevice = new Map();
  oneTimeKeysByDevice.set(matrixDeviceId, oneTimeKeyMap);
  oneTimeKeysByUser.set(matrixUserId, oneTimeKeysByDevice);

  await machine.createOutboundSessions(userDeviceKeys, oneTimeKeysByUser);
}

export async function encryptToDeviceMessage(
  userId: string,
  deviceId: string,
  eventType: string,
  content: any
): Promise<EncryptedMessage> {
  const machine = getOlmMachine();

  const matrixUserId = new MatrixCrypto.UserId(userId);
  const matrixDeviceId = new MatrixCrypto.DeviceId(deviceId);

  const toDeviceRequests = await machine.encryptToDeviceEvent(
    matrixUserId,
    matrixDeviceId,
    eventType,
    JSON.stringify(content)
  );

  if (toDeviceRequests.length === 0) {
    throw new Error('No encrypted message generated');
  }

  const request = toDeviceRequests[0];
  const encryptedContent = request.body;

  const messageType = encryptedContent.ciphertext ? MessageType.Message : MessageType.PreKey;

  return {
    type: messageType,
    body: JSON.stringify(encryptedContent),
    sessionId: `${currentUserId}:${currentDeviceId}-${userId}:${deviceId}`,
  };
}

export async function decryptToDeviceMessage(
  senderId: string,
  senderDeviceId: string,
  encryptedMessage: EncryptedMessage
): Promise<PlaintextMessage> {
  const machine = getOlmMachine();

  const matrixSenderId = new MatrixCrypto.UserId(senderId);
  const matrixSenderDeviceId = new MatrixCrypto.DeviceId(senderDeviceId);

  let messageBody: any;
  try {
    messageBody = JSON.parse(encryptedMessage.body);
  } catch (error) {
    throw new Error('Invalid encrypted message format');
  }

  const decryptedEvent = await machine.decryptToDeviceEvent(
    matrixSenderId,
    matrixSenderDeviceId,
    messageBody
  );

  let content: any;
  try {
    content = JSON.parse(decryptedEvent.cleartext);
  } catch (error) {
    throw new Error('Invalid decrypted content format');
  }

  return {
    content: content.content || content.body || content,
    timestamp: content.timestamp || Date.now(),
    messageId: content.messageId || crypto.randomUUID(),
  };
}

export async function encryptMessage(
  session: Session,
  message: PlaintextMessage
): Promise<EncryptedMessage> {
  return encryptToDeviceMessage(
    session.remoteUserId,
    session.remoteDeviceId,
    'm.room.message',
    {
      content: message.content,
      timestamp: message.timestamp,
      messageId: message.messageId,
    }
  );
}

export async function decryptMessage(
  session: Session,
  encryptedMessage: EncryptedMessage
): Promise<PlaintextMessage> {
  return decryptToDeviceMessage(
    session.remoteUserId,
    session.remoteDeviceId,
    encryptedMessage
  );
}

export async function createOutboundSession(
  localIdentityKeys: IdentityKeys,
  remotePreKeyBundle: PreKeyBundle
): Promise<Session> {
  if (!currentDeviceId || !currentUserId) {
    throw new Error('Device not initialized');
  }

  const sessionId = `${currentUserId}:${currentDeviceId}-${remotePreKeyBundle.userId}:${remotePreKeyBundle.deviceId}`;

  return {
    sessionId,
    remoteUserId: remotePreKeyBundle.userId,
    remoteDeviceId: remotePreKeyBundle.deviceId,
    state: {
      rootKey: '',
      chainKey: '',
      nextHeaderKey: '',
      headerKey: '',
      messageKeys: {},
      sendingChain: { chainKey: '', messageNumber: 0 },
      receivingChains: [],
      previousCounter: 0,
    },
  };
}

export async function generateSignedPreKey(_ed25519Key: KeyPair): Promise<KeyPair> {
  throw new Error('generateSignedPreKey is deprecated - use generateOneTimeKeys instead');
}

export async function generateOneTimePreKeys(count: number): Promise<KeyPair[]> {
  const oneTimeKeys = await generateOneTimeKeys(count);
  return oneTimeKeys.map(key => ({
    publicKey: {
      key: key.key,
    },
    privateKey: '',
  }));
}
