// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// Component exports (SolidJS)
export * from './components';
// Stub class for browser environments where E2E is not supported per Signal Protocol requirements
export class EfSecClient {
    constructor(apiUrl) {
        console.warn('E2E encryption disabled: Signal Protocol requires native dependencies not available in browsers');
    }
    async init(authToken) {
        throw new Error('E2E encryption not supported in browser environments per Signal Protocol requirements');
    }
    async startDMSession(userId) {
        throw new Error('E2E encryption not available in browsers');
    }
    async encryptDM(userId, message) {
        throw new Error('E2E encryption not available in browsers');
    }
    async decryptDM(userId, ciphertext) {
        throw new Error('E2E encryption not available in browsers');
    }
    async createGroup(groupId) {
        throw new Error('E2E encryption not available in browsers');
    }
    async joinGroup(groupId) {
        throw new Error('E2E encryption not available in browsers');
    }
    async processIncomingKeyDistribution(senderId, encryptedMessage) {
        throw new Error('E2E encryption not available in browsers');
    }
    async processKeyRequest(senderId, encryptedMessage) {
        throw new Error('E2E encryption not available in browsers');
    }
    async encryptGroupMessage(groupId, message) {
        throw new Error('E2E encryption not available in browsers');
    }
    async decryptGroupMessage(groupId, senderId, senderDeviceId, ciphertext) {
        throw new Error('E2E encryption not available in browsers');
    }
    async rotateGroupKeys(groupId) {
        throw new Error('E2E encryption not available in browsers');
    }
    async handleMemberRemoval(groupId, removedUserId) {
        throw new Error('E2E encryption not available in browsers');
    }
    async handleNewMember(groupId, newMemberId) {
        throw new Error('E2E encryption not available in browsers');
    }
}
export default EfSecClient;
//# sourceMappingURL=index.js.map