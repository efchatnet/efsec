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

export type {
  PublicKey,
  KeyPair,
  IdentityKeys,
  PreKeyBundle,
  DeviceKeys,
  Session,
  SessionState,
  EncryptedMessage,
  PlaintextMessage,
  MessageType,
  KeyStoreData,
  CryptoError,
} from './crypto/types.js';

export {
  DecryptionError,
  SessionError,
  KeyError,
} from './crypto/types.js';

export {
  generateIdentityKeyPair,
  generateSignedPreKey,
  generateOneTimePreKeys,
} from './crypto/keys.js';

export {
  createOutboundSession,
  createInboundSession,
} from './crypto/x3dh.js';

export {
  encryptMessage,
  decryptMessage,
} from './crypto/double-ratchet.js';

export { KeyStore } from './storage/indexed-db.js';

export { initialize as initializeWasm } from './crypto/vodozemac.js';
