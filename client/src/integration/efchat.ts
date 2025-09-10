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

/**
 * Graceful E2E Integration for efchat
 *
 * This module provides a fail-safe integration layer that allows efchat
 * to continue working normally even if E2E encryption fails or is unavailable.
 */

import { EfSecClient } from '../index';

export interface E2EIntegrationConfig {
  apiUrl?: string;
  getAuthToken: () => string | null;
  onE2EStatusChange?: (_enabled: boolean) => void;
  debug?: boolean;
}

export interface MessageEnvelope {
  content: string;
  encrypted?: boolean;
  encryptionData?: {
    type: string;
    deviceId?: number;
  };
}

export interface WebSocketMessage {
  type: string;
  content?: string;
  isGroup?: boolean;
  encrypted?: boolean;
  encryptionData?: {
    type: string;
    deviceId?: number;
  };
  wasEncrypted?: boolean;
}

/**
 * Safe E2E wrapper that gracefully falls back to unencrypted messaging
 */
export class E2EIntegration {
  private client?: EfSecClient;
  private isAvailable: boolean = false;
  private config: E2EIntegrationConfig;
  private initPromise?: Promise<void>;

  constructor(config: E2EIntegrationConfig) {
    this.config = config;
    this.checkAvailability();
  }

  /**
   * Check if E2E module is available
   */
  private async checkAvailability(): Promise<void> {
    try {
      // EfSecClient should always be available since it's our own implementation
      this.isAvailable = true;
      if (this.config.debug) {
        console.error('E2E encryption module loaded successfully');
      }
    } catch (error) {
      this.isAvailable = false;
      console.error('E2E encryption module not available, continuing without E2E', error);

      if (this.config.onE2EStatusChange) {
        this.config.onE2EStatusChange(false);
      }
    }
  }

  /**
   * Initialize E2E if available (non-blocking)
   */
  async initializeE2E(userId: string): Promise<boolean> {
    if (!this.isAvailable) {
      return false;
    }

    // Prevent multiple initializations
    if (this.initPromise) {
      await this.initPromise;
      return this.client !== undefined;
    }

    this.initPromise = this.performInitialization(userId);

    try {
      await this.initPromise;
      return true;
    } catch (error) {
      console.error('E2E initialization failed, continuing without encryption', error);
      return false;
    }
  }

  private async performInitialization(userId: string): Promise<void> {
    const token = this.config.getAuthToken();
    if (!token) {
      throw new Error('No auth token for E2E');
    }

    // Initialize EfSec client
    this.client = new EfSecClient(this.config.apiUrl ?? '/api/e2e');
    await this.client.init(token);

    if (this.config.onE2EStatusChange) {
      this.config.onE2EStatusChange(true);
    }

    if (this.config.debug) {
      console.error('E2E encryption initialized for user:', userId);
    }
  }

  /**
   * Encrypt message if E2E is available, otherwise return plaintext
   */
  async encryptMessage(
    recipientId: string,
    message: string,
    isGroup: boolean = false
  ): Promise<MessageEnvelope> {
    if (!this.client) {
      // E2E not available, send unencrypted
      return {
        content: message,
        encrypted: false,
      };
    }

    try {
      if (isGroup) {
        const encrypted = await this.client.encryptGroupMessage(recipientId, message);
        return {
          content: btoa(String.fromCharCode(...encrypted)),
          encrypted: true,
          encryptionData: { type: 'group' },
        };
      } else {
        const encrypted = await this.client.encryptDM(recipientId, message);
        return {
          content: btoa(String.fromCharCode(...encrypted)),
          encrypted: true,
          encryptionData: { type: 'dm' },
        };
      }
    } catch (error) {
      console.error('Encryption failed, sending unencrypted:', error);
      return {
        content: message,
        encrypted: false,
      };
    }
  }

  /**
   * Decrypt message if E2E is available and message is encrypted
   */
  async decryptMessage(
    senderId: string,
    envelope: MessageEnvelope,
    isGroup: boolean = false
  ): Promise<string> {
    // If not encrypted or E2E not available, return as-is
    if (!envelope.encrypted || !this.client) {
      return envelope.content;
    }

    try {
      // Convert base64 back to Uint8Array
      const binaryString = atob(envelope.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      if (isGroup && envelope.encryptionData?.type === 'group') {
        return await this.client.decryptGroupMessage(
          senderId, // Assuming this is groupId
          senderId,
          1, // device ID - Matrix Protocol default device ID
          bytes
        );
      } else {
        return await this.client.decryptDM(senderId, bytes);
      }
    } catch (error) {
      console.error('Decryption failed, showing encrypted content:', error);
      return envelope.content;
    }
  }

  /**
   * Initiate DM if E2E is available
   */
  async initiateDM(peerId: string): Promise<string | null> {
    if (!this.client) {
      console.error('E2E client not available');
      return null;
    }

    try {
      await this.client.startDMSession(peerId);
      return `dm_${peerId}`;
    } catch (error) {
      console.error('Failed to initiate E2E DM:', error);
      return null;
    }
  }

  /**
   * Check if E2E is ready
   */
  isE2EReady(): boolean {
    return this.isAvailable && this.client !== undefined;
  }

  /**
   * Get E2E status
   */
  getStatus(): {
    available: boolean;
    initialized: boolean;
    hasSession: boolean;
  } {
    return {
      available: this.isAvailable,
      initialized: this.client !== undefined,
      hasSession: false, // Would need to check specific session
    };
  }

  /**
   * Cleanup E2E resources
   */
  async cleanup(): Promise<void> {
    if (this.client) {
      delete this.client;
    }
  }
}

/**
 * WebSocket message interceptor for automatic E2E handling
 */
export class E2EWebSocketInterceptor {
  private e2e: E2EIntegration;

  constructor(e2e: E2EIntegration) {
    this.e2e = e2e;
  }

  /**
   * Process outgoing message
   */
  async processOutgoing(
    message: WebSocketMessage,
    recipientId?: string
  ): Promise<WebSocketMessage> {
    // Only process text messages
    if (message.type !== 'message' || !message.content || !recipientId) {
      return message;
    }

    const envelope = await this.e2e.encryptMessage(recipientId, message.content, message.isGroup);

    const result: WebSocketMessage = {
      ...message,
      content: envelope.content,
    };

    if (envelope.encrypted !== undefined) {
      result.encrypted = envelope.encrypted;
    }

    if (envelope.encryptionData !== undefined) {
      result.encryptionData = envelope.encryptionData;
    }

    return result;
  }

  /**
   * Process incoming message
   */
  async processIncoming(message: WebSocketMessage, senderId?: string): Promise<WebSocketMessage> {
    // Only process encrypted messages
    if (!message.encrypted || !message.content || !senderId) {
      return message;
    }

    const envelope: MessageEnvelope = {
      content: message.content,
      encrypted: message.encrypted,
    };

    if (message.encryptionData !== undefined) {
      envelope.encryptionData = message.encryptionData;
    }

    const decrypted = await this.e2e.decryptMessage(senderId, envelope, message.isGroup);

    return {
      ...message,
      content: decrypted,
      wasEncrypted: true,
    };
  }
}

/**
 * Factory function for safe E2E integration
 */
export function createE2EIntegration(config: E2EIntegrationConfig): E2EIntegration {
  return new E2EIntegration(config);
}
