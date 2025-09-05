// Copyright (C) 2024 William Theesfeld <william@theesfeld.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import * as SignalClient from '@signalapp/libsignal-client';
import * as crypto from 'crypto';

export interface SenderKey {
  chainKey: Uint8Array;
  signatureKeyPair: {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
  };
  keyVersion: number;
}

export interface GroupSession {
  groupId: string;
  mySenderKey: SenderKey;
  memberSenderKeys: Map<string, {
    chainKey: Uint8Array;
    publicSignatureKey: Uint8Array;
    keyVersion: number;
  }>;
}

export class SenderKeysProtocol {
  private groupSessions: Map<string, GroupSession>;
  private messageKeyCache: Map<string, Uint8Array>;

  constructor() {
    this.groupSessions = new Map();
    this.messageKeyCache = new Map();
  }

  async generateSenderKey(keyVersion: number = 1): Promise<SenderKey> {
    // Generate random chain key
    const chainKey = crypto.randomBytes(32);
    
    // Generate signature key pair
    const privateKey = await SignalClient.PrivateKey.generate();
    const publicKey = privateKey.getPublicKey();

    return {
      chainKey,
      signatureKeyPair: {
        privateKey: privateKey.serialize(),
        publicKey: publicKey.serialize()
      },
      keyVersion
    };
  }

  async createGroupSession(groupId: string): Promise<SenderKey> {
    const senderKey = await this.generateSenderKey();
    
    this.groupSessions.set(groupId, {
      groupId,
      mySenderKey: senderKey,
      memberSenderKeys: new Map()
    });

    return senderKey;
  }

  addMemberSenderKey(
    groupId: string,
    memberId: string,
    senderKey: {
      chainKey: Uint8Array;
      publicSignatureKey: Uint8Array;
      keyVersion: number;
    }
  ): void {
    const session = this.groupSessions.get(groupId);
    if (!session) {
      throw new Error('Group session not found');
    }

    session.memberSenderKeys.set(memberId, senderKey);
  }

  private deriveMessageKey(chainKey: Uint8Array): {
    messageKey: Uint8Array;
    nextChainKey: Uint8Array;
  } {
    // Derive message key using HKDF
    const messageKey = crypto.createHmac('sha256', chainKey)
      .update('MessageKey')
      .digest();
    
    // Ratchet chain key forward
    const nextChainKey = crypto.createHmac('sha256', chainKey)
      .update('ChainKey')
      .digest();

    return {
      messageKey: new Uint8Array(messageKey),
      nextChainKey: new Uint8Array(nextChainKey)
    };
  }

  async encryptGroupMessage(
    groupId: string,
    plaintext: Uint8Array
  ): Promise<{
    ciphertext: Uint8Array;
    signature: Uint8Array;
    keyVersion: number;
  }> {
    const session = this.groupSessions.get(groupId);
    if (!session) {
      throw new Error('Group session not found');
    }

    // Derive message key and update chain key
    const { messageKey, nextChainKey } = this.deriveMessageKey(
      session.mySenderKey.chainKey
    );
    session.mySenderKey.chainKey = nextChainKey;

    // Encrypt with AES-256-CBC
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', messageKey.slice(0, 32), iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final()
    ]);

    // Create ciphertext with IV prepended
    const ciphertext = new Uint8Array(Buffer.concat([iv, encrypted]));

    // Sign the ciphertext
    const privateKey = SignalClient.PrivateKey.deserialize(
      session.mySenderKey.signatureKeyPair.privateKey
    );
    const signature = privateKey.sign(ciphertext);

    return {
      ciphertext,
      signature,
      keyVersion: session.mySenderKey.keyVersion
    };
  }

  async decryptGroupMessage(
    groupId: string,
    senderId: string,
    ciphertext: Uint8Array,
    signature: Uint8Array,
    keyVersion: number
  ): Promise<Uint8Array> {
    const session = this.groupSessions.get(groupId);
    if (!session) {
      throw new Error('Group session not found');
    }

    const memberKey = session.memberSenderKeys.get(senderId);
    if (!memberKey) {
      throw new Error('Sender key not found');
    }

    if (memberKey.keyVersion !== keyVersion) {
      throw new Error('Key version mismatch');
    }

    // Verify signature
    const publicKey = SignalClient.PublicKey.deserialize(memberKey.publicSignatureKey);
    const verified = publicKey.verify(ciphertext, signature);
    if (!verified) {
      throw new Error('Invalid signature');
    }

    // Derive message key
    const { messageKey, nextChainKey } = this.deriveMessageKey(memberKey.chainKey);
    memberKey.chainKey = nextChainKey;

    // Extract IV and encrypted data
    const iv = ciphertext.slice(0, 16);
    const encrypted = ciphertext.slice(16);

    // Decrypt with AES-256-CBC
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      messageKey.slice(0, 32),
      iv
    );
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return new Uint8Array(decrypted);
  }

  async rotateGroupKeys(groupId: string): Promise<SenderKey> {
    const session = this.groupSessions.get(groupId);
    if (!session) {
      throw new Error('Group session not found');
    }

    // Generate new sender key with incremented version
    const newSenderKey = await this.generateSenderKey(
      session.mySenderKey.keyVersion + 1
    );
    
    session.mySenderKey = newSenderKey;
    
    // Clear member keys (they need to redistribute)
    session.memberSenderKeys.clear();

    return newSenderKey;
  }

  removeGroupMember(groupId: string, memberId: string): void {
    const session = this.groupSessions.get(groupId);
    if (session) {
      session.memberSenderKeys.delete(memberId);
    }
  }
}