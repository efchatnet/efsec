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

export interface OutboundGroupSession {
  sessionId(): string;
  sessionKey(): string;
  messageIndex(): number;
  encrypt(plaintext: string): string;
  pickle(key: Uint8Array): string;
  creationTime(): bigint;
}

export interface InboundGroupSession {
  sessionId(): string;
  firstKnownIndex(): number;
  decrypt(ciphertext: string): GroupSessionDecryptionResult;
  pickle(key: Uint8Array): string;
  export(messageIndex?: number): string;
}

export interface GroupSessionDecryptionResult {
  plaintext: string;
  messageIndex: number;
}

export interface MegolmSessionData {
  sessionId: string;
  sessionKey: string;
  messageIndex: number;
  creationTime: number;
  roomId: string;
  senderKey: string;
  deviceId: string;
}

class OutboundGroupSessionWrapper implements OutboundGroupSession {
  private _sessionId: string;
  private _sessionKey: string;
  private _messageIndex: number;
  private _creationTime: bigint;

  constructor(sessionId: string, sessionKey: string, messageIndex = 0) {
    this._sessionId = sessionId;
    this._sessionKey = sessionKey;
    this._messageIndex = messageIndex;
    this._creationTime = BigInt(Date.now());
  }

  sessionId(): string {
    return this._sessionId;
  }

  sessionKey(): string {
    return this._sessionKey;
  }

  messageIndex(): number {
    return this._messageIndex;
  }

  encrypt(plaintext: string): string {
    // Note: This is a placeholder. In a real implementation,
    // encryption would be handled through the OlmMachine
    this._messageIndex++;
    return JSON.stringify({
      algorithm: 'm.megolm.v1.aes-sha2',
      sender_key: this._sessionKey,
      ciphertext: btoa(plaintext),
      device_id: 'unknown',
      session_id: this._sessionId,
    });
  }

  pickle(_key: Uint8Array): string {
    return btoa(
      JSON.stringify({
        sessionId: this._sessionId,
        sessionKey: this._sessionKey,
        messageIndex: this._messageIndex,
        creationTime: this._creationTime.toString(),
      })
    );
  }

  creationTime(): bigint {
    return this._creationTime;
  }
}

class InboundGroupSessionWrapper implements InboundGroupSession {
  private _sessionId: string;
  private _firstKnownIndex: number;

  constructor(sessionId: string, firstKnownIndex = 0) {
    this._sessionId = sessionId;
    this._firstKnownIndex = firstKnownIndex;
  }

  sessionId(): string {
    return this._sessionId;
  }

  firstKnownIndex(): number {
    return this._firstKnownIndex;
  }

  decrypt(ciphertext: string): GroupSessionDecryptionResult {
    // Note: This is a placeholder. In a real implementation,
    // decryption would be handled through the OlmMachine
    try {
      const parsed = JSON.parse(ciphertext);
      return {
        plaintext: atob(parsed.ciphertext || ''),
        messageIndex: parsed.message_index || 0,
      };
    } catch {
      throw new Error('Failed to decrypt message');
    }
  }

  pickle(_key: Uint8Array): string {
    return btoa(
      JSON.stringify({
        sessionId: this._sessionId,
        firstKnownIndex: this._firstKnownIndex,
      })
    );
  }

  export(messageIndex?: number): string {
    return JSON.stringify({
      algorithm: 'm.megolm.v1.aes-sha2',
      session_id: this._sessionId,
      session_key: 'exported_key',
      forwarding_curve25519_key_chain: [],
      first_known_index: messageIndex ?? this._firstKnownIndex,
    });
  }
}

export function createOutboundGroupSession(): OutboundGroupSession {
  const sessionId = generateSessionId();
  const sessionKey = generateSessionKey();
  return new OutboundGroupSessionWrapper(sessionId, sessionKey);
}

export function createInboundGroupSessionFromKey(_sessionKey: string): InboundGroupSession {
  const sessionId = generateSessionId();
  return new InboundGroupSessionWrapper(sessionId);
}

export function createInboundGroupSessionFromExport(exportedSession: string): InboundGroupSession {
  try {
    const parsed = JSON.parse(exportedSession);
    return new InboundGroupSessionWrapper(
      parsed.session_id || generateSessionId(),
      parsed.first_known_index || 0
    );
  } catch {
    throw new Error('Invalid exported session format');
  }
}

export function unpickleOutboundGroupSession(
  pickled: string,
  _key: Uint8Array
): OutboundGroupSession {
  try {
    const data = JSON.parse(atob(pickled));
    return new OutboundGroupSessionWrapper(data.sessionId, data.sessionKey, data.messageIndex);
  } catch {
    throw new Error('Failed to unpickle outbound group session');
  }
}

export function unpickleInboundGroupSession(
  pickled: string,
  _key: Uint8Array
): InboundGroupSession {
  try {
    const data = JSON.parse(atob(pickled));
    return new InboundGroupSessionWrapper(data.sessionId, data.firstKnownIndex);
  } catch {
    throw new Error('Failed to unpickle inbound group session');
  }
}

function generateSessionId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function generateSessionKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64Encode(array);
}

export function generatePickleKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export function base64Encode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data));
}

export function base64Decode(data: string): Uint8Array {
  return new Uint8Array(
    atob(data)
      .split('')
      .map((c) => c.charCodeAt(0))
  );
}
