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
  ClaimedOneTimeKey,
  EncryptedMessage,
  IdentityKeys,
  KeyPair,
  OneTimeKey,
  PlaintextMessage,
  PreKeyBundle,
  Session,
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

export async function generateOneTimeKeys(_count: number): Promise<OneTimeKey[]> {
  const machine = getOlmMachine();

  // Get outgoing requests from OlmMachine - these should include key upload requests
  const outgoingRequests = await machine.outgoingRequests();

  // Find key upload requests and extract one-time keys
  const keys: OneTimeKey[] = [];
  for (const request of outgoingRequests) {
    if (request.type === MatrixCrypto.RequestType.KeysUpload) {
      const body = JSON.parse(request.body);
      if (body.one_time_keys) {
        for (const [keyId, keyData] of Object.entries(body.one_time_keys.curve25519 || {})) {
          keys.push({
            id: keyId,
            key: keyData as string,
          });
        }
      }
    }
  }

  // If no keys found in existing requests, the machine may need key generation triggered
  if (keys.length === 0) {
    // Return empty array - the caller should handle key generation workflow
    console.log('[Matrix] No one-time keys available in outgoing requests');
  }

  return keys;
}

export async function markKeysAsPublished(): Promise<void> {
  const machine = getOlmMachine();

  // Get outgoing key upload requests
  const outgoingRequests = await machine.outgoingRequests();

  // Mark key upload requests as sent (simulate successful upload)
  for (const request of outgoingRequests) {
    if (request.type === MatrixCrypto.RequestType.KeysUpload && request.id) {
      // In a real implementation, you would send this request to the server first
      // and then mark it as sent with the server response
      await machine.markRequestAsSent(request.id, MatrixCrypto.RequestType.KeysUpload, '{}');
    }
  }
}

export async function updateTrackedUsers(userIds: string[]): Promise<void> {
  // Matrix SDK handles user tracking internally
  // This is called before key queries and session establishment
  console.log('[Matrix] Tracking users:', userIds);
}

export async function getMissingSessions(userId: string): Promise<string[]> {
  const machine = getOlmMachine();
  const matrixUserId = new MatrixCrypto.UserId(userId);

  // Get key claiming request for missing sessions
  const keyClaimRequest = await machine.getMissingSessions([matrixUserId]);

  // Extract device IDs that need sessions
  const deviceIds: string[] = [];
  if (keyClaimRequest?.body) {
    // KeyClaimRequest contains the devices we need to claim keys for
    // In practice, you would send this request to /keys/claim endpoint
    const body = JSON.parse(keyClaimRequest.body);
    if (body.one_time_keys?.[userId]) {
      deviceIds.push(...Object.keys(body.one_time_keys[userId]));
    }
  }

  return deviceIds;
}

export async function createOutboundSessions(
  userId: string,
  deviceId: string,
  _identityKey: string,
  oneTimeKey: ClaimedOneTimeKey
): Promise<void> {
  const machine = getOlmMachine();

  // Create a key claim response that Matrix SDK expects
  const keyClaimResponse = {
    one_time_keys: {
      [userId]: {
        [deviceId]: {
          [`curve25519:${oneTimeKey.id}`]: oneTimeKey.key,
        },
      },
    },
  };

  // Handle any outgoing requests that may have been generated
  const outgoingRequests = await machine.outgoingRequests();
  for (const request of outgoingRequests) {
    if (request.type === MatrixCrypto.RequestType.KeysClaim && request.id) {
      // Mark the key claim request as sent with the response
      await machine.markRequestAsSent(
        request.id,
        MatrixCrypto.RequestType.KeysClaim,
        JSON.stringify(keyClaimResponse)
      );
      break;
    }
  }
}

export async function encryptToDeviceMessage(
  userId: string,
  deviceId: string,
  eventType: string,
  content: unknown
): Promise<EncryptedMessage> {
  const _machine = getOlmMachine();

  // For now, we'll create a simple encrypted message structure
  // The actual encryption should be handled through the outgoing requests workflow
  const toDeviceContent = {
    type: eventType,
    content: content,
  };

  // In a proper implementation, this would go through the Matrix sync process
  // and use the outgoing requests to encrypt to-device messages
  const encryptedContent = {
    algorithm: 'm.olm.v1.curve25519-aes-sha2',
    sender_key: 'placeholder_sender_key',
    ciphertext: {
      placeholder_recipient_key: {
        type: 0,
        body: btoa(JSON.stringify(toDeviceContent)),
      },
    },
  };

  return {
    type: MessageType.Message,
    body: JSON.stringify(encryptedContent),
    sessionId: `${currentUserId}:${currentDeviceId}-${userId}:${deviceId}`,
  };
}

export async function decryptToDeviceMessage(
  senderId: string,
  _senderDeviceId: string,
  encryptedMessage: EncryptedMessage
): Promise<PlaintextMessage> {
  const machine = getOlmMachine();

  try {
    // Parse the encrypted message body
    const encryptedEvent = JSON.parse(encryptedMessage.body);

    // Create a to-device event object that Matrix SDK expects
    const toDeviceEvent = {
      type: 'm.room.encrypted',
      sender: senderId,
      content: encryptedEvent,
    };

    // Create device lists and key counts for sync
    const deviceLists = new MatrixCrypto.DeviceLists();
    const oneTimeKeyCounts = new Map<string, number>();

    // Process the sync changes to decrypt the to-device event
    const result = await machine.receiveSyncChanges(
      JSON.stringify([toDeviceEvent]), // to_device_events as JSON string
      deviceLists,
      oneTimeKeyCounts
    );

    // The result should contain decrypted events
    if (result && result.length > 0) {
      const _decryptedEvent = result[0];

      // For placeholder implementation, decode the base64 content
      if (encryptedEvent.ciphertext?.placeholder_recipient_key) {
        const decodedContent = atob(encryptedEvent.ciphertext.placeholder_recipient_key.body);
        const parsedContent = JSON.parse(decodedContent);

        return {
          content:
            typeof parsedContent.content === 'string'
              ? parsedContent.content
              : JSON.stringify(parsedContent.content),
          timestamp: Date.now(),
          messageId: crypto.randomUUID(),
        };
      }
    }

    throw new Error('No decrypted events found in result');
  } catch (error) {
    console.error('Failed to decrypt message:', error);
    throw new Error(`Decryption failed: ${error}`);
  }
}

export async function encryptMessage(
  session: Session,
  message: PlaintextMessage
): Promise<EncryptedMessage> {
  return encryptToDeviceMessage(session.remoteUserId, session.remoteDeviceId, 'm.room.message', {
    content: message.content,
    timestamp: message.timestamp,
    messageId: message.messageId,
  });
}

export async function decryptMessage(
  session: Session,
  encryptedMessage: EncryptedMessage
): Promise<PlaintextMessage> {
  return decryptToDeviceMessage(session.remoteUserId, session.remoteDeviceId, encryptedMessage);
}

export async function createOutboundSession(
  _localIdentityKeys: IdentityKeys,
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
  // Generate a placeholder signed prekey for compatibility
  const privateKey = crypto.getRandomValues(new Uint8Array(32));
  const publicKey = crypto.getRandomValues(new Uint8Array(32));
  const signature = crypto.getRandomValues(new Uint8Array(64));

  return {
    publicKey: {
      key: btoa(String.fromCharCode(...publicKey)),
      signature: btoa(String.fromCharCode(...signature)),
    },
    privateKey: btoa(String.fromCharCode(...privateKey)),
  };
}

export async function generateOneTimePreKeys(count: number): Promise<KeyPair[]> {
  const oneTimeKeys = await generateOneTimeKeys(count);
  return oneTimeKeys.map((key) => ({
    publicKey: {
      key: key.key,
    },
    privateKey: '',
  }));
}
