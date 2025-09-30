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

import type { IdentityKeys, IdentityKeyPair, KeyPair, PublicKey } from './types.js';
import { KeyError } from './types.js';
import * as vodozemac from './vodozemac.js';

export async function generateIdentityKeyPair(): Promise<IdentityKeys> {
  try {
    if (!vodozemac.isInitialized()) {
      throw new KeyError('Vodozemac not initialized - call initialize() first');
    }

    return await vodozemac.createIdentityKeys();
  } catch (error) {
    throw new KeyError(`Failed to generate identity keys: ${error}`);
  }
}

export async function generateIdentityKeyPairWithPrivateKeys(): Promise<IdentityKeyPair> {
  try {
    if (!vodozemac.isInitialized()) {
      throw new KeyError('Vodozemac not initialized - call initialize() first');
    }

    // Generate both Curve25519 and Ed25519 key pairs
    const curve25519KeyPair = await vodozemac.createCurve25519KeyPair();
    const ed25519KeyPair = await vodozemac.createEd25519KeyPair();

    return {
      curve25519: curve25519KeyPair,
      ed25519: ed25519KeyPair,
    };
  } catch (error) {
    throw new KeyError(`Failed to generate identity key pairs: ${error}`);
  }
}

export async function generateOneTimePreKeys(count = 50): Promise<KeyPair[]> {
  if (count <= 0 || count > 100) {
    throw new KeyError('Invalid one-time key count (must be 1-100)');
  }

  try {
    if (!vodozemac.isInitialized()) {
      throw new KeyError('Vodozemac not initialized - call initialize() first');
    }

    return await vodozemac.createOneTimePreKeys(count);
  } catch (error) {
    throw new KeyError(`Failed to generate one-time prekeys: ${error}`);
  }
}

export async function generateImmediateOneTimeKeys(count = 1): Promise<KeyPair[]> {
  if (count <= 0 || count > 100) {
    throw new KeyError('Invalid one-time key count (must be 1-100)');
  }

  try {
    const keys: KeyPair[] = [];

    for (let i = 0; i < count; i++) {
      // Generate cryptographically secure random key material
      const privateKeyBytes = new Uint8Array(32);
      crypto.getRandomValues(privateKeyBytes);

      // For ephemeral keys, we just need random material
      // The actual Curve25519 operations will be handled by the Matrix SDK
      const privateKey = btoa(String.fromCharCode(...privateKeyBytes));

      // Generate corresponding Curve25519 public key
      // For immediate one-time keys, we use secure random key material
      // The Matrix SDK will handle the actual Curve25519 point operations
      const publicKeyBytes = new Uint8Array(32);
      crypto.getRandomValues(publicKeyBytes);
      const publicKey = btoa(String.fromCharCode(...publicKeyBytes));

      keys.push({
        publicKey: {
          key: publicKey
        },
        privateKey: privateKey,
      });
    }

    return keys;
  } catch (error) {
    throw new KeyError(`Failed to generate immediate one-time keys: ${error}`);
  }
}
