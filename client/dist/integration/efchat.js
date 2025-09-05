"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.E2EWebSocketInterceptor = exports.E2EIntegration = void 0;
exports.createE2EIntegration = createE2EIntegration;
/**
 * Safe E2E wrapper that gracefully falls back to unencrypted messaging
 */
class E2EIntegration {
    constructor(config) {
        this.isAvailable = false;
        this.config = config;
        this.checkAvailability();
    }
    /**
     * Check if E2E module is available
     */
    async checkAvailability() {
        try {
            // Dynamically import to prevent hard dependency
            const { SignalManager, DMService } = await Promise.resolve().then(() => __importStar(require('../index')));
            this.isAvailable = true;
            if (this.config.debug) {
                console.log('E2E encryption module loaded successfully');
            }
        }
        catch (error) {
            this.isAvailable = false;
            console.warn('E2E encryption module not available, continuing without E2E', error);
            if (this.config.onE2EStatusChange) {
                this.config.onE2EStatusChange(false);
            }
        }
    }
    /**
     * Initialize E2E if available (non-blocking)
     */
    async initializeE2E(userId) {
        if (!this.isAvailable) {
            return false;
        }
        // Prevent multiple initializations
        if (this.initPromise) {
            await this.initPromise;
            return this.signalManager !== undefined;
        }
        this.initPromise = this.performInitialization(userId);
        try {
            await this.initPromise;
            return true;
        }
        catch (error) {
            console.warn('E2E initialization failed, continuing without encryption', error);
            return false;
        }
    }
    async performInitialization(userId) {
        const token = this.config.getAuthToken();
        if (!token) {
            throw new Error('No auth token for E2E');
        }
        const { SignalManager, DMService } = await Promise.resolve().then(() => __importStar(require('../index')));
        // Initialize Signal Manager
        this.signalManager = new SignalManager({
            apiUrl: this.config.apiUrl || '/api/e2e',
            authToken: token,
            userId
        });
        await this.signalManager.initialize();
        // Initialize DM Service
        this.dmService = new DMService({
            apiUrl: this.config.apiUrl || '/api/e2e',
            getAuthToken: this.config.getAuthToken,
            signalManager: this.signalManager
        });
        if (this.config.onE2EStatusChange) {
            this.config.onE2EStatusChange(true);
        }
        if (this.config.debug) {
            console.log('E2E encryption initialized for user:', userId);
        }
    }
    /**
     * Encrypt message if E2E is available, otherwise return plaintext
     */
    async encryptMessage(recipientId, message, isGroup = false) {
        if (!this.signalManager) {
            // E2E not available, send unencrypted
            return {
                content: message,
                encrypted: false
            };
        }
        try {
            if (isGroup) {
                const groupManager = this.signalManager.groupProtocol;
                const encrypted = await groupManager.encryptMessage(recipientId, message);
                return {
                    content: encrypted,
                    encrypted: true
                };
            }
            else {
                const encrypted = await this.signalManager.encryptMessage(recipientId, message);
                return {
                    content: JSON.stringify(encrypted),
                    encrypted: true,
                    encryptionData: {
                        type: encrypted.type,
                        deviceId: encrypted.deviceId
                    }
                };
            }
        }
        catch (error) {
            console.warn('Encryption failed, sending unencrypted:', error);
            return {
                content: message,
                encrypted: false
            };
        }
    }
    /**
     * Decrypt message if E2E is available and message is encrypted
     */
    async decryptMessage(senderId, envelope, isGroup = false) {
        // If not encrypted or E2E not available, return as-is
        if (!envelope.encrypted || !this.signalManager) {
            return envelope.content;
        }
        try {
            if (isGroup) {
                const groupManager = this.signalManager.groupProtocol;
                // Assuming group message format
                const parsed = JSON.parse(envelope.content);
                return await groupManager.decryptMessage(parsed.groupId, senderId, parsed.message);
            }
            else {
                const encryptedData = JSON.parse(envelope.content);
                return await this.signalManager.decryptMessage(senderId, encryptedData.encrypted, encryptedData.type);
            }
        }
        catch (error) {
            console.warn('Decryption failed, showing encrypted content:', error);
            return envelope.content;
        }
    }
    /**
     * Initiate DM if E2E is available
     */
    async initiateDM(peerId) {
        if (!this.dmService) {
            console.warn('DM service not available');
            return null;
        }
        try {
            const dmSpace = await this.dmService.initiateDM(peerId);
            return dmSpace.spaceId;
        }
        catch (error) {
            console.error('Failed to initiate E2E DM:', error);
            return null;
        }
    }
    /**
     * Check if E2E is ready
     */
    isE2EReady() {
        return this.isAvailable && this.signalManager !== undefined;
    }
    /**
     * Get E2E status
     */
    getStatus() {
        return {
            available: this.isAvailable,
            initialized: this.signalManager !== undefined,
            hasSession: false // Would need to check specific session
        };
    }
    /**
     * Cleanup E2E resources
     */
    async cleanup() {
        if (this.signalManager) {
            await this.signalManager.cleanup();
            this.signalManager = undefined;
            this.dmService = undefined;
        }
    }
}
exports.E2EIntegration = E2EIntegration;
/**
 * WebSocket message interceptor for automatic E2E handling
 */
class E2EWebSocketInterceptor {
    constructor(e2e) {
        this.e2e = e2e;
    }
    /**
     * Process outgoing message
     */
    async processOutgoing(message, recipientId) {
        // Only process text messages
        if (message.type !== 'message' || !message.content || !recipientId) {
            return message;
        }
        const envelope = await this.e2e.encryptMessage(recipientId, message.content, message.isGroup);
        return {
            ...message,
            content: envelope.content,
            encrypted: envelope.encrypted,
            encryptionData: envelope.encryptionData
        };
    }
    /**
     * Process incoming message
     */
    async processIncoming(message, senderId) {
        // Only process encrypted messages
        if (!message.encrypted || !message.content || !senderId) {
            return message;
        }
        const decrypted = await this.e2e.decryptMessage(senderId, {
            content: message.content,
            encrypted: message.encrypted,
            encryptionData: message.encryptionData
        }, message.isGroup);
        return {
            ...message,
            content: decrypted,
            wasEncrypted: true
        };
    }
}
exports.E2EWebSocketInterceptor = E2EWebSocketInterceptor;
/**
 * Factory function for safe E2E integration
 */
function createE2EIntegration(config) {
    return new E2EIntegration(config);
}
//# sourceMappingURL=efchat.js.map