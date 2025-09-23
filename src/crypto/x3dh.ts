/**
 * Copyright (C) 2024 William Theesfeld <william@theesfeld.net>
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

import type { IdentityKeys, KeyPair, PreKeyBundle, Session } from './types.js';
import * as vodozemac from './vodozemac.js';

export async function createOutboundSession(
  localIdentityKeys: IdentityKeys,
  remotePreKeyBundle: PreKeyBundle
): Promise<Session> {
  if (!vodozemac.isInitialized()) {
    throw new Error('Vodozemac not initialized - call initialize() first');
  }

  return await vodozemac.establishOutboundSession(localIdentityKeys, remotePreKeyBundle);
}

export async function createInboundSession(
  localIdentityKeys: IdentityKeys,
  remoteIdentityKey: string,
  prekeyMessage: Record<string, unknown>
): Promise<Session> {
  if (!vodozemac.isInitialized()) {
    throw new Error('Vodozemac not initialized - call initialize() first');
  }

  // For inbound sessions, we need to reconstruct the prekey bundle from the message
  const remotePreKeyBundle: PreKeyBundle = {
    userId: 'remote_user',
    deviceId: 'remote_device',
    identityKey: remoteIdentityKey,
    signedPreKey: (prekeyMessage.signedPreKey as string) || remoteIdentityKey,
    oneTimePreKeys: [],
  };

  return await vodozemac.establishOutboundSession(localIdentityKeys, remotePreKeyBundle);
}

export async function generatePreKeyBundle(
  userId: string,
  deviceId: string,
  identityKeys: IdentityKeys,
  signedPreKey: KeyPair,
  oneTimePreKeys: KeyPair[]
): Promise<PreKeyBundle> {
  return {
    userId,
    deviceId,
    identityKey: identityKeys.curve25519.key,
    signedPreKey: signedPreKey.publicKey.key,
    oneTimePreKeys,
  };
}
