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

import {
  createOlmMachine,
  createOutboundSession,
  decryptMessage,
  encryptMessage,
  generateIdentityKeyPair,
  generateOneTimePreKeys,
  initializeWasm,
} from './wasm.js';

import type {
  EncryptedMessage,
  IdentityKeys,
  KeyPair,
  PlaintextMessage,
  PreKeyBundle,
  Session,
} from './types.js';

let currentUserId: string | null = null;
let currentDeviceId: string | null = null;

export async function initialize(userId: string, deviceId: string): Promise<void> {
  await initializeWasm();

  // Ensure userId is in proper Matrix format (@localpart:domain)
  let matrixUserId = userId;
  if (!userId.startsWith('@') || !userId.includes(':')) {
    // Convert simple userId to Matrix format
    matrixUserId = `@${userId}:efchat.net`;
  }

  await createOlmMachine(matrixUserId, deviceId);
  currentUserId = matrixUserId;
  currentDeviceId = deviceId;
}

export async function createIdentityKeys(): Promise<IdentityKeys> {
  if (!currentUserId || !currentDeviceId) {
    throw new Error('Vodozemac not initialized');
  }
  return await generateIdentityKeyPair();
}


export async function createOneTimePreKeys(count: number): Promise<KeyPair[]> {
  return await generateOneTimePreKeys(count);
}

export async function establishOutboundSession(
  localIdentityKeys: IdentityKeys,
  remotePreKeyBundle: PreKeyBundle
): Promise<Session> {
  return await createOutboundSession(localIdentityKeys, remotePreKeyBundle);
}

export async function encrypt(
  session: Session,
  message: PlaintextMessage
): Promise<EncryptedMessage> {
  return await encryptMessage(session, message);
}

export async function decrypt(
  session: Session,
  encryptedMessage: EncryptedMessage
): Promise<PlaintextMessage> {
  return await decryptMessage(session, encryptedMessage);
}

export function isInitialized(): boolean {
  return currentUserId !== null && currentDeviceId !== null;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function getCurrentDeviceId(): string | null {
  return currentDeviceId;
}
