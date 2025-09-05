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
  constructor(apiUrl: string) {
    console.warn('E2E encryption disabled: Signal Protocol requires native dependencies not available in browsers');
  }

  async init(authToken?: string): Promise<void> {
    throw new Error('E2E encryption not supported in browser environments per Signal Protocol requirements');
  }

  async startDMSession(userId: string): Promise<void> {
    throw new Error('E2E encryption not available in browsers');
  }

  async encryptDM(userId: string, message: string): Promise<Uint8Array> {
    throw new Error('E2E encryption not available in browsers');
  }

  async decryptDM(userId: string, ciphertext: Uint8Array): Promise<string> {
    throw new Error('E2E encryption not available in browsers');
  }

  async createGroup(groupId: string): Promise<void> {
    throw new Error('E2E encryption not available in browsers');
  }

  async joinGroup(groupId: string): Promise<void> {
    throw new Error('E2E encryption not available in browsers');
  }

  async processIncomingKeyDistribution(senderId: string, encryptedMessage: Uint8Array): Promise<void> {
    throw new Error('E2E encryption not available in browsers');
  }

  async processKeyRequest(senderId: string, encryptedMessage: Uint8Array): Promise<void> {
    throw new Error('E2E encryption not available in browsers');
  }

  async encryptGroupMessage(groupId: string, message: string): Promise<Uint8Array> {
    throw new Error('E2E encryption not available in browsers');
  }

  async decryptGroupMessage(groupId: string, senderId: string, senderDeviceId: number, ciphertext: Uint8Array): Promise<string> {
    throw new Error('E2E encryption not available in browsers');
  }

  async rotateGroupKeys(groupId: string): Promise<void> {
    throw new Error('E2E encryption not available in browsers');
  }

  async handleMemberRemoval(groupId: string, removedUserId: string): Promise<void> {
    throw new Error('E2E encryption not available in browsers');
  }

  async handleNewMember(groupId: string, newMemberId: string): Promise<void> {
    throw new Error('E2E encryption not available in browsers');
  }
}

export default EfSecClient;