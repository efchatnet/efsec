// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import { SignalProtocol } from '../protocol/signal';
import { GroupProtocol } from '../protocol/groups';
import { SenderKeyDistributionMessage } from '@signalapp/libsignal-client';

export interface KeyDistributionMessage {
  type: 'sender_key_distribution';
  groupId: string;
  senderKeyDistribution: Uint8Array;
  timestamp: number;
}

export class KeyDistributionService {
  private signalProtocol: SignalProtocol;
  private groupProtocol: GroupProtocol;
  private apiUrl: string;
  private authToken?: string;

  constructor(
    signalProtocol: SignalProtocol,
    groupProtocol: GroupProtocol,
    apiUrl: string,
    authToken?: string
  ) {
    this.signalProtocol = signalProtocol;
    this.groupProtocol = groupProtocol;
    this.apiUrl = apiUrl;
    this.authToken = authToken;
  }

  /**
   * Distribute sender key to all group members via encrypted DMs
   */
  async distributeGroupKeys(
    groupId: string,
    distributionMessage: SenderKeyDistributionMessage
  ): Promise<void> {
    // Get all group members from server
    const members = await this.fetchGroupMembers(groupId);
    
    // Serialize the distribution message once
    const serializedDistribution = distributionMessage.serialize();
    
    // Distribute to each member via encrypted DM
    const distributions = members.map(memberId => 
      this.sendKeyDistributionDM(memberId, groupId, serializedDistribution)
    );
    
    await Promise.all(distributions);
  }

  /**
   * Send sender key distribution via encrypted DM
   */
  private async sendKeyDistributionDM(
    recipientId: string,
    groupId: string,
    senderKeyDistribution: Uint8Array
  ): Promise<void> {
    // Ensure we have a Signal session with the recipient
    if (!await this.signalProtocol.hasSession(recipientId)) {
      await this.establishSession(recipientId);
    }

    // Create key distribution message
    const message: KeyDistributionMessage = {
      type: 'sender_key_distribution',
      groupId,
      senderKeyDistribution: Array.from(senderKeyDistribution) as any,
      timestamp: Date.now()
    };

    // Encrypt the message
    const plaintext = new TextEncoder().encode(JSON.stringify(message));
    const ciphertext = await this.signalProtocol.encryptMessage(recipientId, plaintext);

    // Send via backend (as an encrypted DM)
    await this.sendEncryptedDM(recipientId, ciphertext.serialize());
  }

  /**
   * Process received key distribution message
   */
  async processKeyDistributionMessage(
    senderId: string,
    encryptedMessage: Uint8Array
  ): Promise<void> {
    // Decrypt the message
    const plaintext = await this.signalProtocol.decryptMessage(senderId, encryptedMessage);
    const messageStr = new TextDecoder().decode(plaintext);
    const message = JSON.parse(messageStr) as KeyDistributionMessage;

    // Verify it's a key distribution message
    if (message.type !== 'sender_key_distribution') {
      throw new Error('Not a key distribution message');
    }

    // Process the sender key distribution
    await this.groupProtocol.processSenderKeyDistribution(
      message.groupId,
      senderId,
      1, // Device ID - we're assuming single device for now
      new Uint8Array(message.senderKeyDistribution)
    );
  }

  /**
   * Request sender keys from all group members
   */
  async requestGroupKeys(groupId: string): Promise<void> {
    const members = await this.fetchGroupMembers(groupId);
    
    // Send key request to each member
    const requests = members.map(memberId =>
      this.sendKeyRequest(memberId, groupId)
    );
    
    await Promise.all(requests);
  }

  /**
   * Send a request for sender keys
   */
  private async sendKeyRequest(
    recipientId: string,
    groupId: string
  ): Promise<void> {
    // Ensure we have a Signal session
    if (!await this.signalProtocol.hasSession(recipientId)) {
      await this.establishSession(recipientId);
    }

    const request = {
      type: 'sender_key_request',
      groupId,
      timestamp: Date.now()
    };

    const plaintext = new TextEncoder().encode(JSON.stringify(request));
    const ciphertext = await this.signalProtocol.encryptMessage(recipientId, plaintext);
    
    await this.sendEncryptedDM(recipientId, ciphertext.serialize());
  }

  /**
   * Handle key request from another member
   */
  async processKeyRequest(
    senderId: string,
    encryptedMessage: Uint8Array
  ): Promise<void> {
    // Decrypt the request
    const plaintext = await this.signalProtocol.decryptMessage(senderId, encryptedMessage);
    const messageStr = new TextDecoder().decode(plaintext);
    const request = JSON.parse(messageStr);

    if (request.type !== 'sender_key_request') {
      throw new Error('Not a key request');
    }

    // Check if we're in the group
    if (!await this.groupProtocol.isGroupMember(request.groupId)) {
      return; // Ignore requests for groups we're not in
    }

    // Create our distribution message for this group
    const distributionMessage = await this.groupProtocol.createGroup(request.groupId);
    
    // Send it to the requester
    await this.sendKeyDistributionDM(senderId, request.groupId, distributionMessage.serialize());
  }

  /**
   * Rotate keys and distribute to all members
   */
  async rotateAndDistributeKeys(groupId: string): Promise<void> {
    // Rotate our keys
    const newDistribution = await this.groupProtocol.rotateGroupKeys(groupId);
    
    // Distribute new keys to all members
    await this.distributeGroupKeys(groupId, newDistribution);
  }

  /**
   * Establish Signal session with a user
   */
  private async establishSession(userId: string): Promise<void> {
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
    
    // Process the prekey bundle to establish session
    await this.signalProtocol.processPreKeyBundle(
      userId,
      {
        registrationId: bundle.registration_id,
        identityKey: new Uint8Array(bundle.identity_public_key),
        signedPreKeyId: bundle.signed_pre_key.id,
        signedPreKeyPublic: new Uint8Array(bundle.signed_pre_key.public_key),
        signedPreKeySignature: new Uint8Array(bundle.signed_pre_key.signature),
        preKeyId: bundle.one_time_pre_key?.id,
        preKeyPublic: bundle.one_time_pre_key ? 
          new Uint8Array(bundle.one_time_pre_key.public_key) : undefined
      }
    );
  }

  /**
   * Send encrypted DM via backend
   */
  private async sendEncryptedDM(
    recipientId: string,
    ciphertext: Uint8Array
  ): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/e2e/dm/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({
        recipient_id: recipientId,
        ciphertext: Array.from(ciphertext),
        message_type: 'key_distribution'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to send encrypted DM');
    }
  }

  /**
   * Fetch group members from backend
   */
  private async fetchGroupMembers(groupId: string): Promise<string[]> {
    const response = await fetch(`${this.apiUrl}/api/e2e/group/${groupId}/members`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch group members');
    }

    const data = await response.json();
    return data.members;
  }

  /**
   * Handle member removal - distribute new keys to remaining members
   */
  async handleMemberRemoval(groupId: string, removedUserId: string): Promise<void> {
    // Remove member locally
    await this.groupProtocol.removeGroupMember(groupId, removedUserId, 1);
    
    // Rotate and redistribute keys to remaining members
    await this.rotateAndDistributeKeys(groupId);
  }

  /**
   * Handle new member joining - send them current keys and get theirs
   */
  async handleNewMember(groupId: string, newMemberId: string): Promise<void> {
    // Create our distribution message
    const ourDistribution = await this.groupProtocol.createGroup(groupId);
    
    // Send our keys to the new member
    await this.sendKeyDistributionDM(
      newMemberId,
      groupId,
      ourDistribution.serialize()
    );
    
    // Request their keys
    await this.sendKeyRequest(newMemberId, groupId);
  }
}