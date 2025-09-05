// Copyright (C) 2024 William Theesfeld <william@theesfeld.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import * as SignalClient from '@signalapp/libsignal-client';

export interface SignalKeys {
  identityKeyPair: SignalClient.PrivateKey;
  registrationId: number;
  signedPreKey: {
    keyId: number;
    keyPair: SignalClient.PrivateKey;
    signature: Uint8Array;
  };
  oneTimePreKeys: Array<{
    keyId: number;
    keyPair: SignalClient.PrivateKey;
  }>;
}

export class SignalProtocol {
  private sessionStore: Map<string, SignalClient.SessionRecord>;
  private identityStore: Map<string, SignalClient.PublicKey>;
  private preKeyStore: Map<number, SignalClient.PrivateKey>;
  private signedPreKeyStore: Map<number, SignalClient.PrivateKey>;

  constructor() {
    this.sessionStore = new Map();
    this.identityStore = new Map();
    this.preKeyStore = new Map();
    this.signedPreKeyStore = new Map();
  }

  async generateIdentityKeyPair(): Promise<SignalClient.PrivateKey> {
    return SignalClient.PrivateKey.generate();
  }

  async generateRegistrationId(): Promise<number> {
    return Math.floor(Math.random() * 16383) + 1;
  }

  async generateSignedPreKey(
    identityKey: SignalClient.PrivateKey,
    keyId: number
  ): Promise<{
    keyId: number;
    keyPair: SignalClient.PrivateKey;
    signature: Uint8Array;
  }> {
    const keyPair = await SignalClient.PrivateKey.generate();
    const publicKey = keyPair.getPublicKey();
    const signature = identityKey.sign(publicKey.serialize());

    return {
      keyId,
      keyPair,
      signature
    };
  }

  async generatePreKeys(start: number, count: number): Promise<Array<{
    keyId: number;
    keyPair: SignalClient.PrivateKey;
  }>> {
    const preKeys = [];
    for (let i = 0; i < count; i++) {
      const keyPair = await SignalClient.PrivateKey.generate();
      preKeys.push({
        keyId: start + i,
        keyPair
      });
    }
    return preKeys;
  }

  async generateInitialKeys(): Promise<SignalKeys> {
    const identityKeyPair = await this.generateIdentityKeyPair();
    const registrationId = await this.generateRegistrationId();
    const signedPreKey = await this.generateSignedPreKey(identityKeyPair, 1);
    const oneTimePreKeys = await this.generatePreKeys(1, 100);

    return {
      identityKeyPair,
      registrationId,
      signedPreKey,
      oneTimePreKeys
    };
  }

  async processPreKeyBundle(
    userId: string,
    bundle: {
      registrationId: number;
      identityKey: Uint8Array;
      signedPreKeyId: number;
      signedPreKeyPublic: Uint8Array;
      signedPreKeySignature: Uint8Array;
      preKeyId?: number;
      preKeyPublic?: Uint8Array;
    },
    ourIdentityKey: SignalClient.PrivateKey,
    ourRegistrationId: number
  ): Promise<void> {
    const theirIdentityKey = SignalClient.PublicKey.deserialize(bundle.identityKey);
    const theirSignedPreKey = SignalClient.PublicKey.deserialize(bundle.signedPreKeyPublic);
    
    // Verify signature
    const verified = theirIdentityKey.verify(
      bundle.signedPreKeyPublic,
      bundle.signedPreKeySignature
    );
    
    if (!verified) {
      throw new Error('Invalid signed prekey signature');
    }

    const theirPreKey = bundle.preKeyPublic 
      ? SignalClient.PublicKey.deserialize(bundle.preKeyPublic)
      : undefined;

    const preKeyBundle = SignalClient.PreKeyBundle.new(
      bundle.registrationId,
      1, // deviceId
      bundle.preKeyId,
      theirPreKey,
      bundle.signedPreKeyId,
      theirSignedPreKey,
      bundle.signedPreKeySignature,
      theirIdentityKey
    );

    const address = SignalClient.ProtocolAddress.new(userId, 1);
    
    await SignalClient.processPreKeyBundle(
      preKeyBundle,
      address,
      this.sessionStore,
      this.identityStore
    );
  }

  async encryptMessage(
    userId: string,
    message: Uint8Array
  ): Promise<SignalClient.CiphertextMessage> {
    const address = SignalClient.ProtocolAddress.new(userId, 1);
    const sessionRecord = this.sessionStore.get(userId);
    
    if (!sessionRecord) {
      throw new Error('No session established');
    }

    return await SignalClient.signalEncrypt(
      Buffer.from(message),
      address,
      sessionRecord,
      this.identityStore
    );
  }

  async decryptMessage(
    userId: string,
    ciphertext: SignalClient.CiphertextMessage
  ): Promise<Uint8Array> {
    const address = SignalClient.ProtocolAddress.new(userId, 1);
    const sessionRecord = this.sessionStore.get(userId);
    
    if (!sessionRecord) {
      throw new Error('No session established');
    }

    if (ciphertext.type() === SignalClient.CiphertextMessageType.PreKey) {
      return await SignalClient.signalDecryptPreKey(
        ciphertext as SignalClient.PreKeySignalMessage,
        address,
        sessionRecord,
        this.identityStore,
        this.preKeyStore,
        this.signedPreKeyStore
      );
    } else {
      return await SignalClient.signalDecrypt(
        ciphertext as SignalClient.SignalMessage,
        address,
        sessionRecord,
        this.identityStore
      );
    }
  }
}