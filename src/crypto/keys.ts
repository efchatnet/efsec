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

import type { IdentityKeys, KeyPair, PublicKey } from './types.js';
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

export async function generateSignedPreKey(identityKey: KeyPair): Promise<KeyPair> {
  try {
    if (!vodozemac.isInitialized()) {
      throw new KeyError('Vodozemac not initialized - call initialize() first');
    }

    return await vodozemac.createSignedPreKey(identityKey);
  } catch (error) {
    throw new KeyError(`Failed to generate signed prekey: ${error}`);
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
