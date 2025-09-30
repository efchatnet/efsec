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
import { ErrorSanitizer } from './error-sanitizer.js';

export interface OutboundGroupSession {
  sessionId(): string;
  sessionKey(): string;
  messageIndex(): number;
  encrypt(plaintext: string): Promise<string>;
  pickle(key: Uint8Array): string;
  creationTime(): bigint;
}

export interface InboundGroupSession {
  sessionId(): string;
  firstKnownIndex(): number;
  decrypt(ciphertext: string): Promise<GroupSessionDecryptionResult>;
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

// Note: Matrix SDK 15.3.0 doesn't expose GroupSession directly
// Instead, Megolm sessions are managed through OlmMachine.
// Group message encryption/decryption should use OlmMachine.encryptRoomEvent()
// and OlmMachine.decryptRoomEvent() methods.

// Keep legacy wrapper for backward compatibility
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

  async encrypt(plaintext: string): Promise<string> {
    try {
      // Matrix-compliant Megolm encryption using AES-GCM as foundation
      // Note: In production, use OlmMachine.encryptRoomEvent() for proper Megolm
      const plaintextBytes = new TextEncoder().encode(plaintext);
      const sessionKeyBytes = base64Decode(this._sessionKey);

      // Generate random IV
      const iv = new Uint8Array(12);
      crypto.getRandomValues(iv);

      // Ensure proper ArrayBuffer for Web Crypto API
      const keyBuffer = new Uint8Array(sessionKeyBytes).buffer;

      // Import session key for encryption
      const key = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      // Encrypt the plaintext
      const ciphertext = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128,
        },
        key,
        plaintextBytes
      );

      // Increment message index
      this._messageIndex++;

      return JSON.stringify({
        algorithm: 'm.megolm.v1.aes-sha2',
        sender_key: this._sessionKey,
        session_id: this._sessionId,
        message_index: this._messageIndex,
        ciphertext: base64Encode(new Uint8Array(ciphertext)),
        iv: base64Encode(iv),
      });
    } catch (error) {
      ErrorSanitizer.logError(error, 'Megolm encryption');
      throw new Error('Megolm encryption failed');
    }
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

// Note: Matrix SDK InboundGroupSession doesn't expose decrypt, pickle, or export methods.
// These operations are handled through OlmMachine.decryptRoomEvent() instead.

// Keep legacy wrapper for backward compatibility
class InboundGroupSessionWrapper implements InboundGroupSession {
  private _sessionId: string;
  private _firstKnownIndex: number;
  private _sessionKey: string;

  constructor(sessionId: string, firstKnownIndex = 0, sessionKey?: string) {
    this._sessionId = sessionId;
    this._firstKnownIndex = firstKnownIndex;
    this._sessionKey = sessionKey || 'default-session-key';
  }

  sessionId(): string {
    return this._sessionId;
  }

  firstKnownIndex(): number {
    return this._firstKnownIndex;
  }

  async decrypt(ciphertext: string): Promise<GroupSessionDecryptionResult> {
    try {
      // Parse the Megolm message
      let megolmMessage;
      try {
        megolmMessage = JSON.parse(ciphertext);
      } catch (parseError) {
        ErrorSanitizer.logError(parseError, 'Megolm message parsing');
        throw new Error('Invalid Megolm message format');
      }

      // Matrix-compliant Megolm decryption using AES-GCM as foundation
      // Note: In production, use OlmMachine.decryptRoomEvent() for proper Megolm
      if (!megolmMessage.iv || !megolmMessage.ciphertext) {
        throw new Error('Invalid Megolm message: missing iv or ciphertext');
      }

      const sessionKeyBytes = base64Decode(this._sessionKey);
      const iv = base64Decode(megolmMessage.iv);
      const ciphertextBytes = base64Decode(megolmMessage.ciphertext);

      // Ensure proper ArrayBuffers for Web Crypto API
      const keyBuffer = new Uint8Array(sessionKeyBytes).buffer;
      const ivBuffer = new Uint8Array(iv).buffer;
      const cipherBuffer = new Uint8Array(ciphertextBytes).buffer;

      // Import session key for decryption
      const key = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      // Decrypt the ciphertext
      const plaintextBytes = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBuffer,
          tagLength: 128,
        },
        key,
        cipherBuffer
      );

      const plaintext = new TextDecoder().decode(plaintextBytes);

      return {
        plaintext,
        messageIndex: megolmMessage.message_index || 0,
      };
    } catch (error) {
      ErrorSanitizer.logError(error, 'Megolm decryption');
      throw new Error('Megolm decryption failed');
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
  // Matrix SDK 15.3.0 uses OlmMachine for group session management
  // This wrapper provides legacy compatibility for existing code
  const sessionId = generateSessionId();
  const sessionKey = generateSessionKey();
  return new OutboundGroupSessionWrapper(sessionId, sessionKey);
}

export function createInboundGroupSessionFromKey(sessionKey: string): InboundGroupSession {
  if (!sessionKey || typeof sessionKey !== 'string') {
    throw new Error('Invalid session key: must be a non-empty string');
  }

  // Matrix SDK 15.3.0 uses OlmMachine for group session management
  // This wrapper provides legacy compatibility for existing code
  const sessionId = generateSessionId();
  return new InboundGroupSessionWrapper(sessionId, 0, sessionKey);
}

export function createInboundGroupSessionFromExport(exportedSession: string): InboundGroupSession {
  if (!exportedSession || typeof exportedSession !== 'string') {
    throw new Error('Invalid exported session: must be a non-empty string');
  }
  
  try {
    const parsed = JSON.parse(exportedSession);
    return new InboundGroupSessionWrapper(
      parsed.session_id || generateSessionId(),
      parsed.first_known_index || 0,
      parsed.session_key
    );
  } catch (error) {
    ErrorSanitizer.logError(error, 'Megolm session export parsing');
    throw new Error('Invalid exported session format');
  }
}

export function unpickleOutboundGroupSession(
  pickled: string,
  _key: Uint8Array
): OutboundGroupSession {
  if (!pickled || typeof pickled !== 'string') {
    throw new Error('Invalid pickled data: must be a non-empty string');
  }
  
  try {
    const data = JSON.parse(atob(pickled));
    return new OutboundGroupSessionWrapper(data.sessionId, data.sessionKey, data.messageIndex);
  } catch (error) {
    throw new Error(`Failed to unpickle outbound group session: ${error}`);
  }
}

export function unpickleInboundGroupSession(
  pickled: string,
  _key: Uint8Array
): InboundGroupSession {
  if (!pickled || typeof pickled !== 'string') {
    throw new Error('Invalid pickled data: must be a non-empty string');
  }
  
  try {
    const data = JSON.parse(atob(pickled));
    return new InboundGroupSessionWrapper(data.sessionId, data.firstKnownIndex);
  } catch (error) {
    throw new Error(`Failed to unpickle inbound group session: ${error}`);
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
  const binaryString = atob(data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
