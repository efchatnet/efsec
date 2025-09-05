// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import { SignalProtocol } from './signal';
import { GroupProtocol } from './groups';
import { CiphertextMessageType } from '@signalapp/libsignal-client';

export interface SignalManagerConfig {
  apiUrl: string;
  authToken: string;
  userId: string;
}

export interface EncryptedMessage {
  encrypted: string;
  type: number;
  deviceId?: number;
}

/**
 * High-level Signal Protocol manager for efchat integration
 * Handles key management, session establishment, and message encryption/decryption
 */
export class SignalManager {
  private signal: SignalProtocol;
  private groupProtocol: GroupProtocol;
  private config: SignalManagerConfig;
  private initialized: boolean = false;

  constructor(config: SignalManagerConfig) {
    this.config = config;
    this.signal = new SignalProtocol();
    this.groupProtocol = new GroupProtocol(this.signal);
  }

  /**
   * Initialize the Signal Protocol and register keys with backend
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize stores
    await this.signal.initialize();
    
    // Check if we have existing keys
    let registrationId: number;
    try {
      registrationId = await this.signal.getRegistrationId();
    } catch {
      // Generate and register new keys if none exist
      await this.registerInitialKeys();
      registrationId = await this.signal.getRegistrationId();
    }

    // Initialize group protocol
    await this.groupProtocol.initialize();

    this.initialized = true;
    console.log(`Signal Protocol initialized for user ${this.config.userId} with registration ID ${registrationId}`);
  }

  /**
   * Generate and register initial Signal keys with the backend
   */
  private async registerInitialKeys(): Promise<void> {
    const keys = await this.signal.generateInitialKeys();

    // Register with backend
    const response = await fetch(`${this.config.apiUrl}/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.authToken}`
      },
      body: JSON.stringify({
        registration_id: keys.registrationId,
        identity_public_key: Array.from(keys.identityKeyPair.publicKey.serialize()),
        signed_pre_key: {
          id: keys.signedPreKey.keyId,
          public_key: Array.from(keys.signedPreKey.keyPair.publicKey.serialize()),
          signature: Array.from(keys.signedPreKey.signature)
        },
        one_time_pre_keys: keys.oneTimePreKeys.map(pk => ({
          id: pk.keyId,
          public_key: Array.from(pk.keyPair.publicKey.serialize())
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to register keys: ${response.statusText}`);
    }
  }

  /**
   * Establish a session with another user if not already established
   */
  async establishSession(userId: string, deviceId: number = 1): Promise<void> {
    // Check if session already exists
    if (await this.signal.hasSession(userId, deviceId)) {
      return;
    }

    // Fetch recipient's prekey bundle
    const response = await fetch(`${this.config.apiUrl}/bundle/${userId}`, {
      headers: {
        'Authorization': `Bearer ${this.config.authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch prekey bundle: ${response.statusText}`);
    }

    const bundle = await response.json();

    // Process the prekey bundle to establish session
    await this.signal.processPreKeyBundle(userId, deviceId, {
      registrationId: bundle.registration_id,
      identityKey: new Uint8Array(bundle.identity_public_key),
      signedPreKeyId: bundle.signed_pre_key.id,
      signedPreKeyPublic: new Uint8Array(bundle.signed_pre_key.public_key),
      signedPreKeySignature: new Uint8Array(bundle.signed_pre_key.signature),
      preKeyId: bundle.one_time_pre_key?.id,
      preKeyPublic: bundle.one_time_pre_key ? 
        new Uint8Array(bundle.one_time_pre_key.public_key) : undefined
    });

    // Mark used prekey on backend
    if (bundle.one_time_pre_key?.id) {
      await fetch(`${this.config.apiUrl}/keys/consume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.authToken}`
        },
        body: JSON.stringify({
          user_id: userId,
          key_id: bundle.one_time_pre_key.id
        })
      });
    }
  }

  /**
   * Encrypt a message for a recipient
   */
  async encryptMessage(
    recipientId: string, 
    message: string, 
    deviceId: number = 1
  ): Promise<EncryptedMessage> {
    // Ensure session is established
    await this.establishSession(recipientId, deviceId);

    // Encrypt the message
    const plaintext = new TextEncoder().encode(message);
    const ciphertext = await this.signal.encryptMessage(recipientId, deviceId, plaintext);

    return {
      encrypted: btoa(String.fromCharCode(...ciphertext.serialize())),
      type: ciphertext.type(),
      deviceId
    };
  }

  /**
   * Decrypt a received message
   */
  async decryptMessage(
    senderId: string,
    encryptedData: string,
    messageType: number,
    deviceId: number = 1
  ): Promise<string> {
    // Convert from base64
    const ciphertext = new Uint8Array(
      atob(encryptedData).split('').map(c => c.charCodeAt(0))
    );

    // Decrypt based on message type
    const plaintext = await this.signal.decryptMessage(
      senderId,
      deviceId,
      ciphertext,
      messageType as CiphertextMessageType
    );

    return new TextDecoder().decode(plaintext);
  }

  /**
   * Check and replenish one-time prekeys if running low
   */
  async checkAndReplenishKeys(threshold: number = 10): Promise<void> {
    const count = await this.signal.getUnusedPreKeyCount();
    
    if (count < threshold) {
      // Generate new prekeys
      const startId = 100 + Math.floor(Math.random() * 1000);
      const newKeys = await this.signal.replenishPreKeys(startId, 100);

      // Register with backend
      await fetch(`${this.config.apiUrl}/keys/replenish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.authToken}`
        },
        body: JSON.stringify({
          one_time_pre_keys: newKeys.map(k => ({
            id: k.keyId,
            public_key: Array.from(k.publicKey)
          }))
        })
      });

      console.log(`Replenished ${newKeys.length} one-time prekeys`);
    }
  }

  /**
   * Rotate signed prekey periodically (e.g., every 7 days)
   */
  async rotateSignedPreKey(): Promise<void> {
    const keyId = Math.floor(Date.now() / 1000); // Use timestamp as key ID
    const newKey = await this.signal.rotateSignedPreKey(keyId);

    // Update backend
    await fetch(`${this.config.apiUrl}/keys/signed`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.authToken}`
      },
      body: JSON.stringify({
        id: newKey.keyId,
        public_key: Array.from(newKey.publicKey),
        signature: Array.from(newKey.signature)
      })
    });

    console.log('Rotated signed prekey');
  }

  /**
   * Get the group protocol instance
   */
  getGroupProtocol(): GroupProtocol {
    return this.groupProtocol;
  }

  /**
   * Cleanup and destroy session data
   */
  async cleanup(): Promise<void> {
    // Clear sessions and keys from memory
    this.initialized = false;
    console.log('Signal Protocol cleaned up');
  }

  /**
   * Check if Signal Protocol is ready
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Check if a session exists with a user
   */
  async hasSession(userId: string, deviceId: number = 1): Promise<boolean> {
    return await this.signal.hasSession(userId, deviceId);
  }
}