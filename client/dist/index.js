"use strict";
// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EfSecClient = void 0;
const signal_1 = require("./protocol/signal");
const groups_1 = require("./protocol/groups");
const KeyDistributionService_1 = require("./services/KeyDistributionService");
const indexeddb_1 = require("./storage/indexeddb");
// Core Protocol exports
__exportStar(require("./protocol/signal"), exports);
__exportStar(require("./protocol/groups"), exports);
__exportStar(require("./protocol/SignalManager"), exports);
// Storage exports
__exportStar(require("./storage/indexeddb"), exports);
__exportStar(require("./stores"), exports);
// Service exports
__exportStar(require("./services/DMService"), exports);
__exportStar(require("./services/KeyDistributionService"), exports);
// Component exports (SolidJS)
__exportStar(require("./components"), exports);
class EfSecClient {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
        this.signal = new signal_1.SignalProtocol();
        this.groups = new groups_1.GroupProtocol(this.signal);
        this.storage = new indexeddb_1.E2EStorage();
        this.keyDistribution = new KeyDistributionService_1.KeyDistributionService(this.signal, this.groups, apiUrl);
    }
    async init(authToken) {
        this.authToken = authToken;
        this.keyDistribution = new KeyDistributionService_1.KeyDistributionService(this.signal, this.groups, this.apiUrl, authToken);
        await this.storage.init();
        await this.signal.initialize();
        await this.groups.initialize();
        // Load existing keys if available
        const storedKeys = await this.storage.getIdentityKeys();
        if (!storedKeys) {
            // Generate and register new keys
            await this.setupInitialKeys();
        }
    }
    async setupInitialKeys() {
        const keys = await this.signal.generateInitialKeys();
        // Save to IndexedDB
        await this.storage.saveIdentityKeys({
            identityKeyPair: keys.identityKeyPair.privateKey.serialize(),
            registrationId: keys.registrationId,
            signedPreKey: {
                keyId: keys.signedPreKey.keyId,
                keyPair: keys.signedPreKey.keyPair.privateKey.serialize(),
                signature: keys.signedPreKey.signature
            },
            oneTimePreKeys: keys.oneTimePreKeys.map(pk => ({
                keyId: pk.keyId,
                keyPair: pk.keyPair.privateKey.serialize()
            }))
        });
        // Register with backend
        await this.registerKeys(keys);
    }
    async registerKeys(keys) {
        const response = await fetch(`${this.apiUrl}/api/e2e/keys`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`
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
            throw new Error('Failed to register keys');
        }
    }
    async startDMSession(userId) {
        // Fetch recipient's prekey bundle
        const response = await fetch(`${this.apiUrl}/api/e2e/bundle/${userId}`, {
            headers: {
                'Authorization': `Bearer ${this.authToken}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch prekey bundle');
        }
        const bundle = await response.json();
        const storedKeys = await this.storage.getIdentityKeys();
        if (!storedKeys) {
            throw new Error('No identity keys found');
        }
        // Process the prekey bundle to establish session
        await this.signal.processPreKeyBundle(userId, 1, // deviceId - assuming single device
        {
            registrationId: bundle.registration_id,
            identityKey: new Uint8Array(bundle.identity_public_key),
            signedPreKeyId: bundle.signed_pre_key.id,
            signedPreKeyPublic: new Uint8Array(bundle.signed_pre_key.public_key),
            signedPreKeySignature: new Uint8Array(bundle.signed_pre_key.signature),
            preKeyId: bundle.one_time_pre_key?.id,
            preKeyPublic: bundle.one_time_pre_key ?
                new Uint8Array(bundle.one_time_pre_key.public_key) : undefined
        });
    }
    async encryptDM(userId, message) {
        const plaintext = new TextEncoder().encode(message);
        const ciphertext = await this.signal.encryptMessage(userId, 1, plaintext); // deviceId = 1
        return ciphertext.serialize();
    }
    async decryptDM(userId, ciphertext) {
        // Assuming PreKey message type for initial messages
        const plaintext = await this.signal.decryptMessage(userId, 1, // deviceId
        ciphertext, 2 // CiphertextMessageType.PreKey
        );
        return new TextDecoder().decode(plaintext);
    }
    async createGroup(groupId) {
        // Create group and get our SenderKeyDistributionMessage
        const distributionMessage = await this.groups.createGroup(groupId);
        // Register group with backend (server only tracks membership)
        const response = await fetch(`${this.apiUrl}/api/e2e/group/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`
            },
            body: JSON.stringify({ group_id: groupId })
        });
        if (!response.ok) {
            throw new Error('Failed to create group on server');
        }
        // Get initial members and distribute our keys to them
        await this.keyDistribution.distributeGroupKeys(groupId, distributionMessage);
    }
    async joinGroup(groupId) {
        // Create our SenderKeyDistributionMessage for this group
        const distributionMessage = await this.groups.createGroup(groupId);
        // Register with backend (server only tracks membership)
        const response = await fetch(`${this.apiUrl}/api/e2e/group/${groupId}/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`
            },
            body: JSON.stringify({
            // Server only needs to know we joined, no keys!
            })
        });
        if (!response.ok) {
            throw new Error('Failed to join group on server');
        }
        // Distribute our sender key to all existing members via encrypted DMs
        await this.keyDistribution.distributeGroupKeys(groupId, distributionMessage);
        // Request sender keys from other members
        await this.keyDistribution.requestGroupKeys(groupId);
    }
    async processIncomingKeyDistribution(senderId, encryptedMessage) {
        // Process key distribution messages received via encrypted DMs
        await this.keyDistribution.processKeyDistributionMessage(senderId, encryptedMessage);
    }
    async processKeyRequest(senderId, encryptedMessage) {
        // Process key requests and respond with our keys
        await this.keyDistribution.processKeyRequest(senderId, encryptedMessage);
    }
    async encryptGroupMessage(groupId, message) {
        const plaintext = new TextEncoder().encode(message);
        // Use Signal's group encryption with sender keys
        return await this.groups.encryptGroupMessage(groupId, plaintext);
    }
    async decryptGroupMessage(groupId, senderId, senderDeviceId, ciphertext) {
        // Use Signal's group decryption
        const plaintext = await this.groups.decryptGroupMessage(groupId, senderId, senderDeviceId, ciphertext);
        return new TextDecoder().decode(plaintext);
    }
    async rotateGroupKeys(groupId) {
        // Rotate keys and distribute new keys to all members
        await this.keyDistribution.rotateAndDistributeKeys(groupId);
    }
    async handleMemberRemoval(groupId, removedUserId) {
        // Handle member removal - rotates keys and redistributes
        await this.keyDistribution.handleMemberRemoval(groupId, removedUserId);
    }
    async handleNewMember(groupId, newMemberId) {
        // Handle new member joining - exchange keys
        await this.keyDistribution.handleNewMember(groupId, newMemberId);
    }
}
exports.EfSecClient = EfSecClient;
//# sourceMappingURL=index.js.map