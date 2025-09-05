"use strict";
// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupProtocol = void 0;
const libsignal_client_1 = require("@signalapp/libsignal-client");
const SenderKeyStore_1 = require("../stores/SenderKeyStore");
class GroupProtocol {
    constructor(_signalProtocol) {
        this.initialized = false;
        this.senderKeyStore = new SenderKeyStore_1.SenderKeyStoreImpl();
        this.groupDistributionIds = new Map();
    }
    async initialize() {
        if (this.initialized)
            return;
        await this.senderKeyStore.init();
        await this.loadGroupDistributionIds();
        this.initialized = true;
    }
    async loadGroupDistributionIds() {
        // Load from IndexedDB if we have persisted group IDs
        const db = await this.openGroupDB();
        const transaction = db.transaction(['groups'], 'readonly');
        const store = transaction.objectStore('groups');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const groups = request.result;
                groups.forEach((group) => {
                    this.groupDistributionIds.set(group.groupId, group.distributionId);
                });
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }
    async openGroupDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('efchat-e2e-groups', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('groups')) {
                    db.createObjectStore('groups', { keyPath: 'groupId' });
                }
                if (!db.objectStoreNames.contains('members')) {
                    const memberStore = db.createObjectStore('members', {
                        keyPath: ['groupId', 'userId', 'deviceId']
                    });
                    memberStore.createIndex('groupId', 'groupId', { unique: false });
                }
            };
        });
    }
    async createGroup(groupId) {
        // Generate a new distribution ID for this group
        const distributionId = crypto.randomUUID();
        this.groupDistributionIds.set(groupId, distributionId);
        // Save to IndexedDB
        const db = await this.openGroupDB();
        const transaction = db.transaction(['groups'], 'readwrite');
        const store = transaction.objectStore('groups');
        await new Promise((resolve, reject) => {
            const request = store.put({
                groupId,
                distributionId: distributionId.toString(),
                createdAt: Date.now()
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        // Create our sender key distribution message
        const ourAddress = libsignal_client_1.ProtocolAddress.new('self', 1);
        const distributionMessage = await libsignal_client_1.SenderKeyDistributionMessage.create(ourAddress, distributionId, this.senderKeyStore);
        return distributionMessage;
    }
    async joinGroup(groupId, distributionId) {
        const uuid = distributionId;
        this.groupDistributionIds.set(groupId, uuid);
        // Save to IndexedDB
        const db = await this.openGroupDB();
        const transaction = db.transaction(['groups'], 'readwrite');
        const store = transaction.objectStore('groups');
        await new Promise((resolve, reject) => {
            const request = store.put({
                groupId,
                distributionId,
                joinedAt: Date.now()
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    async processSenderKeyDistribution(groupId, senderId, senderDeviceId, distributionMessage) {
        const distributionId = this.groupDistributionIds.get(groupId);
        if (!distributionId) {
            throw new Error(`Not a member of group ${groupId}`);
        }
        const senderAddress = libsignal_client_1.ProtocolAddress.new(senderId, senderDeviceId);
        const message = libsignal_client_1.SenderKeyDistributionMessage.deserialize(Buffer.from(distributionMessage));
        await (0, libsignal_client_1.processSenderKeyDistributionMessage)(senderAddress, message, this.senderKeyStore);
        // Track group member
        await this.addGroupMember(groupId, senderId, senderDeviceId);
    }
    async encryptGroupMessage(groupId, plaintext) {
        const distributionId = this.groupDistributionIds.get(groupId);
        if (!distributionId) {
            throw new Error(`Not a member of group ${groupId}`);
        }
        const ourAddress = libsignal_client_1.ProtocolAddress.new('self', 1);
        const ciphertext = await (0, libsignal_client_1.groupEncrypt)(ourAddress, distributionId, this.senderKeyStore, Buffer.from(plaintext));
        return ciphertext.serialize();
    }
    async decryptGroupMessage(groupId, senderId, senderDeviceId, ciphertext) {
        const distributionId = this.groupDistributionIds.get(groupId);
        if (!distributionId) {
            throw new Error(`Not a member of group ${groupId}`);
        }
        const senderAddress = libsignal_client_1.ProtocolAddress.new(senderId, senderDeviceId);
        const plaintext = await (0, libsignal_client_1.groupDecrypt)(senderAddress, this.senderKeyStore, Buffer.from(ciphertext));
        return new Uint8Array(plaintext);
    }
    async addGroupMember(groupId, userId, deviceId) {
        const db = await this.openGroupDB();
        const transaction = db.transaction(['members'], 'readwrite');
        const store = transaction.objectStore('members');
        await new Promise((resolve, reject) => {
            const request = store.put({
                groupId,
                userId,
                deviceId,
                addedAt: Date.now()
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    async removeGroupMember(groupId, userId, deviceId) {
        const db = await this.openGroupDB();
        const transaction = db.transaction(['members'], 'readwrite');
        const store = transaction.objectStore('members');
        await new Promise((resolve, reject) => {
            const request = store.delete([groupId, userId, deviceId]);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        // When a member is removed, we should rotate keys
        await this.rotateGroupKeys(groupId);
    }
    async getGroupMembers(groupId) {
        const db = await this.openGroupDB();
        const transaction = db.transaction(['members'], 'readonly');
        const store = transaction.objectStore('members');
        const index = store.index('groupId');
        return new Promise((resolve, reject) => {
            const request = index.getAll(groupId);
            request.onsuccess = () => {
                const members = request.result.map((m) => ({
                    userId: m.userId,
                    deviceId: m.deviceId
                }));
                resolve(members);
            };
            request.onerror = () => reject(request.error);
        });
    }
    async rotateGroupKeys(groupId) {
        const oldDistributionId = this.groupDistributionIds.get(groupId);
        if (!oldDistributionId) {
            throw new Error(`Not a member of group ${groupId}`);
        }
        // Remove all sender keys for the old distribution
        // Note: In libsignal-client, keys are replaced when new distribution is created
        // Create new distribution ID
        const newDistributionId = crypto.randomUUID();
        this.groupDistributionIds.set(groupId, newDistributionId);
        // Save to IndexedDB
        const db = await this.openGroupDB();
        const transaction = db.transaction(['groups'], 'readwrite');
        const store = transaction.objectStore('groups');
        await new Promise((resolve, reject) => {
            const request = store.put({
                groupId,
                distributionId: newDistributionId.toString(),
                rotatedAt: Date.now()
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        // Create new sender key distribution message
        const ourAddress = libsignal_client_1.ProtocolAddress.new('self', 1);
        const distributionMessage = await libsignal_client_1.SenderKeyDistributionMessage.create(ourAddress, newDistributionId, this.senderKeyStore);
        return distributionMessage;
    }
    async leaveGroup(groupId) {
        const distributionId = this.groupDistributionIds.get(groupId);
        if (!distributionId) {
            return; // Already not in group
        }
        // Remove all sender keys for this group
        // Note: In libsignal-client, keys are removed when group is deleted
        // Remove from local state
        this.groupDistributionIds.delete(groupId);
        // Remove from IndexedDB
        const db = await this.openGroupDB();
        const transaction = db.transaction(['groups', 'members'], 'readwrite');
        // Remove group
        const groupStore = transaction.objectStore('groups');
        await new Promise((resolve, reject) => {
            const request = groupStore.delete(groupId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        // Remove all members for this group
        const memberStore = transaction.objectStore('members');
        const index = memberStore.index('groupId');
        const members = await new Promise((resolve, reject) => {
            const request = index.getAll(groupId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        for (const member of members) {
            await new Promise((resolve, reject) => {
                const request = memberStore.delete([
                    member.groupId,
                    member.userId,
                    member.deviceId
                ]);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }
    async isGroupMember(groupId) {
        return this.groupDistributionIds.has(groupId);
    }
    async getGroupDistributionId(groupId) {
        const uuid = this.groupDistributionIds.get(groupId);
        return uuid ? uuid.toString() : null;
    }
}
exports.GroupProtocol = GroupProtocol;
//# sourceMappingURL=groups.js.map