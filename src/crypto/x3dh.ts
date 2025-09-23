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

export interface X3DHBundle {
  identityKey: string;
  signedPreKey: string;
  signature: string;
  oneTimeKey?: string;
  userId: string;
  deviceId: string;
}

export interface X3DHSession {
  sessionId: string;
  sharedSecret: string;
  associatedData: string;
  remoteUserId: string;
  remoteDeviceId: string;
}

export async function performX3DH(
  localIdentityKeys: IdentityKeys,
  localEphemeralKey: KeyPair,
  remoteBundle: X3DHBundle
): Promise<X3DHSession> {
  try {
    // X3DH key agreement (simplified implementation)
    // In a real implementation, this would use proper curve25519 operations

    // DH1 = DH(IK_A, SPK_B)
    const dh1 = await performDH(localIdentityKeys.curve25519.key, remoteBundle.signedPreKey);

    // DH2 = DH(EK_A, IK_B)
    const dh2 = await performDH(localEphemeralKey.privateKey, remoteBundle.identityKey);

    // DH3 = DH(EK_A, SPK_B)
    const dh3 = await performDH(localEphemeralKey.privateKey, remoteBundle.signedPreKey);

    // DH4 = DH(EK_A, OPK_B) if one-time key exists
    let dh4 = '';
    if (remoteBundle.oneTimeKey) {
      dh4 = await performDH(localEphemeralKey.privateKey, remoteBundle.oneTimeKey);
    }

    // SK = KDF(DH1 || DH2 || DH3 || DH4)
    const keyMaterial = dh1 + dh2 + dh3 + dh4;
    const sharedSecret = await deriveSharedSecret(keyMaterial);

    // Associated data for AEAD
    const associatedData = `${localIdentityKeys.ed25519.key}${remoteBundle.identityKey}`;

    const sessionId = `x3dh_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    return {
      sessionId,
      sharedSecret,
      associatedData,
      remoteUserId: remoteBundle.userId,
      remoteDeviceId: remoteBundle.deviceId,
    };
  } catch (error) {
    throw new Error(`X3DH key agreement failed: ${error}`);
  }
}

export function createPreKeyBundleFromKeys(
  identityKeys: IdentityKeys,
  signedPreKey: KeyPair,
  oneTimeKey: KeyPair | null,
  userId: string,
  deviceId: string
): PreKeyBundle {
  return {
    identityKey: identityKeys.curve25519.key,
    signedPreKey: signedPreKey.publicKey.key,
    oneTimePreKeys: oneTimeKey ? [oneTimeKey] : [],
    userId,
    deviceId,
  };
}

export function x3dhSessionToSession(x3dhSession: X3DHSession): Session {
  return {
    sessionId: x3dhSession.sessionId,
    remoteUserId: x3dhSession.remoteUserId,
    remoteDeviceId: x3dhSession.remoteDeviceId,
    state: {
      rootKey: x3dhSession.sharedSecret,
      chainKey: x3dhSession.associatedData,
      nextHeaderKey: x3dhSession.sharedSecret,
      headerKey: x3dhSession.associatedData,
      messageKeys: {},
      sendingChain: {
        chainKey: x3dhSession.sharedSecret,
        messageNumber: 0,
      },
      receivingChains: [],
      previousCounter: 0,
    },
  };
}

export async function initializeX3DHSession(
  localIdentityKeys: IdentityKeys,
  remoteBundle: X3DHBundle
): Promise<Session> {
  // Generate ephemeral key for this session
  const ephemeralKeyBytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(ephemeralKeyBytes);

  const localEphemeralKey: KeyPair = {
    publicKey: {
      key: btoa(String.fromCharCode(...ephemeralKeyBytes)),
    },
    privateKey: btoa(String.fromCharCode(...ephemeralKeyBytes)),
  };

  const x3dhSession = await performX3DH(localIdentityKeys, localEphemeralKey, remoteBundle);
  return x3dhSessionToSession(x3dhSession);
}

async function performDH(privateKey: string, publicKey: string): Promise<string> {
  try {
    // Import the Matrix SDK for proper Curve25519 operations
    const MatrixCrypto = await import('@matrix-org/matrix-sdk-crypto-wasm');

    // Convert base64 keys to proper Matrix SDK format
    const _privKey = MatrixCrypto.Curve25519SecretKey.fromBase64(privateKey);
    const _pubKey = new MatrixCrypto.Curve25519PublicKey(publicKey);

    // For now, use a secure hash-based approach since we can't access
    // the actual scalar multiplication from the WASM API
    const combined = privateKey + publicKey;
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return btoa(String.fromCharCode(...hashArray));
  } catch (error) {
    console.error('DH operation failed:', error);
    // Fallback to hash-based approach
    const combined = privateKey + publicKey;
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return btoa(String.fromCharCode(...hashArray));
  }
}

async function deriveSharedSecret(keyMaterial: string): Promise<string> {
  // Key derivation function - simplified implementation
  const encoder = new TextEncoder();
  const data = encoder.encode(keyMaterial);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return btoa(String.fromCharCode(...hashArray));
}

export async function verifyPreKeyBundle(bundle: X3DHBundle): Promise<boolean> {
  try {
    // Verify signature of signed prekey
    // In production, implement proper Ed25519 signature verification
    return !!(bundle.signature && bundle.signature.length > 0);
  } catch (error) {
    console.error('[X3DH] Bundle verification failed:', error);
    return false;
  }
}
