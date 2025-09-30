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

export interface PublicKey {
  readonly key: string;
  readonly signature?: string;
}

export interface KeyPair {
  readonly publicKey: PublicKey;
  readonly privateKey: string;
}

export interface IdentityKeys {
  readonly curve25519: PublicKey;
  readonly ed25519: PublicKey;
}

export interface IdentityKeyPair {
  readonly curve25519: KeyPair;
  readonly ed25519: KeyPair;
}

export interface PreKeyBundle {
  readonly identityKey: string;
  readonly oneTimePreKeys: KeyPair[];
  readonly deviceId: string;
  readonly userId: string;
}

export interface DeviceKeys {
  readonly userId: string;
  readonly deviceId: string;
  readonly identityKeys: IdentityKeys;
  readonly oneTimePreKeys: PublicKey[];
}

export interface Session {
  readonly sessionId: string;
  readonly remoteUserId: string;
  readonly remoteDeviceId: string;
  readonly state: SessionState;
}

export interface SessionState {
  readonly rootKey: string;
  readonly chainKey: string;
  readonly nextHeaderKey: string;
  readonly headerKey: string;
  readonly messageKeys: Record<string, string>;
  readonly sendingChain: ChainState;
  readonly receivingChains: ChainState[];
  readonly previousCounter: number;
}

export interface ChainState {
  readonly chainKey: string;
  readonly messageNumber: number;
}

export interface EncryptedMessage {
  readonly type: MessageType;
  readonly body: string;
  readonly sessionId: string;
}

export interface PlaintextMessage {
  readonly content: string;
  readonly timestamp: number;
  readonly messageId: string;
}

export enum MessageType {
  PreKey = 0,
  Message = 1,
}

export interface KeyStoreData {
  readonly identityKeys: IdentityKeys;
  readonly oneTimePreKeys: KeyPair[];
  readonly sessions: Record<string, SessionState>;
  readonly deviceId: string;
}

export interface CryptoError extends Error {
  readonly code: string;
  readonly recoverable: boolean;
}

export class DecryptionError extends Error implements CryptoError {
  readonly code = 'DECRYPTION_FAILED';
  readonly recoverable = false;

  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

export class SessionError extends Error implements CryptoError {
  readonly code = 'SESSION_ERROR';
  readonly recoverable = true;

  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

export class KeyError extends Error implements CryptoError {
  readonly code = 'KEY_ERROR';
  readonly recoverable = false;

  constructor(message: string) {
    super(message);
    this.name = 'KeyError';
  }
}

export interface OneTimeKey {
  readonly id: string;
  readonly key: string;
}

export interface ClaimedOneTimeKey {
  readonly id: string;
  readonly key: string;
  readonly userId: string;
  readonly deviceId: string;
}
