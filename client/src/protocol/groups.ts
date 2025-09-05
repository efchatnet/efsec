// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import {
  ProtocolAddress,
  SenderKeyDistributionMessage,
  Uuid,
  groupEncrypt,
  groupDecrypt,
  processSenderKeyDistributionMessage
} from '@signalapp/libsignal-client';

import { SenderKeyStoreImpl } from '../stores/SenderKeyStore';
import { SignalProtocol } from './signal';

export interface GroupMember {
  userId: string;
  deviceId: number;
}

export class GroupProtocol {
  private senderKeyStore: SenderKeyStoreImpl;
  private groupDistributionIds: Map<string, Uuid>;
  private initialized: boolean = false;

  constructor(_signalProtocol: SignalProtocol) {
    this.senderKeyStore = new SenderKeyStoreImpl();
    this.groupDistributionIds = new Map();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.senderKeyStore.init();
    await this.loadGroupDistributionIds();
    
    this.initialized = true;
  }

  private async loadGroupDistributionIds(): Promise<void> {
    // Load from IndexedDB if we have persisted group IDs
    const db = await this.openGroupDB();
    const transaction = db.transaction(['groups'], 'readonly');
    const store = transaction.objectStore('groups');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const groups = request.result;
        groups.forEach((group: any) => {
          this.groupDistributionIds.set(
            group.groupId,
            group.distributionId
          );
        });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async openGroupDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('efchat-e2e-groups', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
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

  async createGroup(groupId: string): Promise<SenderKeyDistributionMessage> {
    // Generate a new distribution ID for this group
    const distributionId = crypto.randomUUID();
    this.groupDistributionIds.set(groupId, distributionId);

    // Save to IndexedDB
    const db = await this.openGroupDB();
    const transaction = db.transaction(['groups'], 'readwrite');
    const store = transaction.objectStore('groups');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        groupId,
        distributionId: distributionId.toString(),
        createdAt: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Create our sender key distribution message
    const ourAddress = ProtocolAddress.new('self', 1);
    const distributionMessage = await SenderKeyDistributionMessage.create(
      ourAddress,
      distributionId,
      this.senderKeyStore
    );

    return distributionMessage;
  }

  async joinGroup(
    groupId: string,
    distributionId: string
  ): Promise<void> {
    const uuid = distributionId;
    this.groupDistributionIds.set(groupId, uuid);

    // Save to IndexedDB
    const db = await this.openGroupDB();
    const transaction = db.transaction(['groups'], 'readwrite');
    const store = transaction.objectStore('groups');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        groupId,
        distributionId,
        joinedAt: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async processSenderKeyDistribution(
    groupId: string,
    senderId: string,
    senderDeviceId: number,
    distributionMessage: Uint8Array
  ): Promise<void> {
    const distributionId = this.groupDistributionIds.get(groupId);
    if (!distributionId) {
      throw new Error(`Not a member of group ${groupId}`);
    }

    const senderAddress = ProtocolAddress.new(senderId, senderDeviceId);
    const message = SenderKeyDistributionMessage.deserialize(
      Buffer.from(distributionMessage)
    );

    await processSenderKeyDistributionMessage(
      senderAddress,
      message,
      this.senderKeyStore
    );

    // Track group member
    await this.addGroupMember(groupId, senderId, senderDeviceId);
  }

  async encryptGroupMessage(
    groupId: string,
    plaintext: Uint8Array
  ): Promise<Uint8Array> {
    const distributionId = this.groupDistributionIds.get(groupId);
    if (!distributionId) {
      throw new Error(`Not a member of group ${groupId}`);
    }

    const ourAddress = ProtocolAddress.new('self', 1);
    
    const ciphertext = await groupEncrypt(
      ourAddress,
      distributionId,
      this.senderKeyStore,
      Buffer.from(plaintext)
    );

    return ciphertext.serialize();
  }

  async decryptGroupMessage(
    groupId: string,
    senderId: string,
    senderDeviceId: number,
    ciphertext: Uint8Array
  ): Promise<Uint8Array> {
    const distributionId = this.groupDistributionIds.get(groupId);
    if (!distributionId) {
      throw new Error(`Not a member of group ${groupId}`);
    }

    const senderAddress = ProtocolAddress.new(senderId, senderDeviceId);
    
    const plaintext = await groupDecrypt(
      senderAddress,
      this.senderKeyStore,
      Buffer.from(ciphertext)
    );

    return new Uint8Array(plaintext);
  }

  async addGroupMember(
    groupId: string,
    userId: string,
    deviceId: number
  ): Promise<void> {
    const db = await this.openGroupDB();
    const transaction = db.transaction(['members'], 'readwrite');
    const store = transaction.objectStore('members');
    
    await new Promise<void>((resolve, reject) => {
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

  async removeGroupMember(
    groupId: string,
    userId: string,
    deviceId: number
  ): Promise<void> {
    const db = await this.openGroupDB();
    const transaction = db.transaction(['members'], 'readwrite');
    const store = transaction.objectStore('members');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete([groupId, userId, deviceId]);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // When a member is removed, we should rotate keys
    await this.rotateGroupKeys(groupId);
  }

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const db = await this.openGroupDB();
    const transaction = db.transaction(['members'], 'readonly');
    const store = transaction.objectStore('members');
    const index = store.index('groupId');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(groupId);
      request.onsuccess = () => {
        const members = request.result.map((m: any) => ({
          userId: m.userId,
          deviceId: m.deviceId
        }));
        resolve(members);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async rotateGroupKeys(groupId: string): Promise<SenderKeyDistributionMessage> {
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
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        groupId,
        distributionId: newDistributionId.toString(),
        rotatedAt: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Create new sender key distribution message
    const ourAddress = ProtocolAddress.new('self', 1);
    const distributionMessage = await SenderKeyDistributionMessage.create(
      ourAddress,
      newDistributionId,
      this.senderKeyStore
    );

    return distributionMessage;
  }

  async leaveGroup(groupId: string): Promise<void> {
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
    await new Promise<void>((resolve, reject) => {
      const request = groupStore.delete(groupId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Remove all members for this group
    const memberStore = transaction.objectStore('members');
    const index = memberStore.index('groupId');
    
    const members = await new Promise<any[]>((resolve, reject) => {
      const request = index.getAll(groupId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    for (const member of members) {
      await new Promise<void>((resolve, reject) => {
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

  async isGroupMember(groupId: string): Promise<boolean> {
    return this.groupDistributionIds.has(groupId);
  }

  async getGroupDistributionId(groupId: string): Promise<string | null> {
    const uuid = this.groupDistributionIds.get(groupId);
    return uuid ? uuid.toString() : null;
  }
}