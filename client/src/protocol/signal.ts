// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import {
  PrivateKey,
  PublicKey,
  PreKeyBundle,
  PreKeySignalMessage,
  SignalMessage,
  CiphertextMessage,
  CiphertextMessageType,
  ProtocolAddress,
  SessionRecord,
  PreKeyRecord,
  SignedPreKeyRecord,
  processPreKeyBundle,
  signalEncrypt,
  signalDecryptPreKey,
  signalDecrypt,
  Direction
} from '@signalapp/libsignal-client';

import {
  SessionStoreImpl,
  IdentityKeyStoreImpl,
  PreKeyStoreImpl,
  SignedPreKeyStoreImpl
} from '../stores';

export interface SignalKeys {
  identityKeyPair: { privateKey: PrivateKey; publicKey: PublicKey };
  registrationId: number;
  signedPreKey: {
    keyId: number;
    keyPair: { privateKey: PrivateKey; publicKey: PublicKey };
    signature: Uint8Array;
  };
  oneTimePreKeys: Array<{
    keyId: number;
    keyPair: { privateKey: PrivateKey; publicKey: PublicKey };
  }>;
}

export class SignalProtocol {
  private sessionStore: SessionStoreImpl;
  private identityStore: IdentityKeyStoreImpl;
  private preKeyStore: PreKeyStoreImpl;
  private signedPreKeyStore: SignedPreKeyStoreImpl;
  private initialized: boolean = false;

  constructor() {
    this.sessionStore = new SessionStoreImpl();
    this.identityStore = new IdentityKeyStoreImpl();
    this.preKeyStore = new PreKeyStoreImpl();
    this.signedPreKeyStore = new SignedPreKeyStoreImpl();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.sessionStore.init(),
      this.identityStore.init(),
      this.preKeyStore.init(),
      this.signedPreKeyStore.init()
    ]);

    this.initialized = true;
  }

  async generateIdentityKeyPair(): Promise<{ privateKey: PrivateKey; publicKey: PublicKey }> {
    const privateKey = PrivateKey.generate();
    const publicKey = privateKey.getPublicKey();
    return { privateKey, publicKey };
  }

  async generateRegistrationId(): Promise<number> {
    // Generate a random registration ID between 1 and 16383
    return Math.floor(Math.random() * 16383) + 1;
  }

  async generateSignedPreKey(
    identityKey: PrivateKey,
    keyId: number
  ): Promise<{
    keyId: number;
    keyPair: { privateKey: PrivateKey; publicKey: PublicKey };
    signature: Uint8Array;
  }> {
    const privateKey = PrivateKey.generate();
    const publicKey = privateKey.getPublicKey();
    const signature = identityKey.sign(publicKey.serialize());

    return {
      keyId,
      keyPair: { privateKey, publicKey },
      signature
    };
  }

  async generatePreKeys(start: number, count: number): Promise<Array<{
    keyId: number;
    keyPair: { privateKey: PrivateKey; publicKey: PublicKey };
  }>> {
    const preKeys = [];
    for (let i = 0; i < count; i++) {
      const privateKey = PrivateKey.generate();
      const publicKey = privateKey.getPublicKey();
      preKeys.push({
        keyId: start + i,
        keyPair: { privateKey, publicKey }
      });
    }
    return preKeys;
  }

  async generateInitialKeys(): Promise<SignalKeys> {
    const identityKeyPair = await this.generateIdentityKeyPair();
    const registrationId = await this.generateRegistrationId();
    const signedPreKey = await this.generateSignedPreKey(identityKeyPair.privateKey, 1);
    const oneTimePreKeys = await this.generatePreKeys(2, 100); // Start at 2, generate 100

    // Store our identity
    await this.identityStore.setIdentityKeyPair(
      identityKeyPair.privateKey,
      registrationId
    );

    // Store signed prekey
    const signedPreKeyRecord = SignedPreKeyRecord.new(
      signedPreKey.keyId,
      Date.now(),
      signedPreKey.keyPair.publicKey,
      signedPreKey.keyPair.privateKey,
      Buffer.from(signedPreKey.signature)
    );
    await this.signedPreKeyStore.saveSignedPreKey(
      signedPreKey.keyId,
      signedPreKeyRecord
    );

    // Store one-time prekeys
    for (const preKey of oneTimePreKeys) {
      const preKeyRecord = PreKeyRecord.new(
        preKey.keyId,
        preKey.keyPair.publicKey,
        preKey.keyPair.privateKey
      );
      await this.preKeyStore.savePreKey(preKey.keyId, preKeyRecord);
    }

    return {
      identityKeyPair,
      registrationId,
      signedPreKey,
      oneTimePreKeys
    };
  }

  async processPreKeyBundle(
    userId: string,
    deviceId: number,
    bundle: {
      registrationId: number;
      identityKey: Uint8Array;
      signedPreKeyId: number;
      signedPreKeyPublic: Uint8Array;
      signedPreKeySignature: Uint8Array;
      preKeyId?: number | null;
      preKeyPublic?: Uint8Array | null;
    }
  ): Promise<void> {
    const theirIdentityKey = PublicKey.deserialize(Buffer.from(bundle.identityKey));
    const theirSignedPreKey = PublicKey.deserialize(Buffer.from(bundle.signedPreKeyPublic));
    
    // Verify signature
    const verified = theirIdentityKey.verify(
      Buffer.from(bundle.signedPreKeyPublic),
      Buffer.from(bundle.signedPreKeySignature)
    );
    
    if (!verified) {
      throw new Error('Invalid signed prekey signature');
    }

    const theirPreKey = bundle.preKeyPublic 
      ? PublicKey.deserialize(Buffer.from(bundle.preKeyPublic))
      : null;

    const preKeyBundle = PreKeyBundle.new(
      bundle.registrationId,
      deviceId,
      bundle.preKeyId || null,
      theirPreKey || null,
      bundle.signedPreKeyId,
      theirSignedPreKey,
      Buffer.from(bundle.signedPreKeySignature),
      theirIdentityKey
    );

    const address = ProtocolAddress.new(userId, deviceId);
    
    await processPreKeyBundle(
      preKeyBundle,
      address,
      this.sessionStore,
      this.identityStore
    );
  }

  async encryptMessage(
    userId: string,
    deviceId: number,
    message: Uint8Array
  ): Promise<CiphertextMessage> {
    const address = ProtocolAddress.new(userId, deviceId);
    const sessionRecord = await this.sessionStore.getSession(address);
    
    if (!sessionRecord) {
      throw new Error('No session established');
    }

    const ciphertext = await signalEncrypt(
      Buffer.from(message),
      address,
      this.sessionStore,
      this.identityStore
    );

    return ciphertext;
  }

  async decryptMessage(
    userId: string,
    deviceId: number,
    ciphertext: Uint8Array,
    type: CiphertextMessageType
  ): Promise<Uint8Array> {
    const address = ProtocolAddress.new(userId, deviceId);
    
    let plaintext: Buffer;

    if (type === CiphertextMessageType.PreKey) {
      // This is a PreKeySignalMessage
      const preKeyMessage = PreKeySignalMessage.deserialize(Buffer.from(ciphertext));
      
      plaintext = await signalDecryptPreKey(
        preKeyMessage,
        address,
        this.sessionStore,
        this.identityStore,
        this.preKeyStore,
        this.signedPreKeyStore,
        null
      );

      // Remove used one-time prekey
      const preKeyId = preKeyMessage.preKeyId();
      if (preKeyId !== null) {
        await this.preKeyStore.removePreKey(preKeyId);
      }
    } else if (type === CiphertextMessageType.Whisper) {
      // This is a regular SignalMessage
      const sessionRecord = await this.sessionStore.getSession(address);
      if (!sessionRecord) {
        throw new Error('No session established');
      }

      const signalMessage = SignalMessage.deserialize(Buffer.from(ciphertext));
      
      plaintext = await signalDecrypt(
        signalMessage,
        address,
        this.sessionStore,
        this.identityStore
      );
    } else {
      throw new Error(`Unsupported message type: ${type}`);
    }

    return new Uint8Array(plaintext);
  }

  async hasSession(userId: string, deviceId: number): Promise<boolean> {
    const address = ProtocolAddress.new(userId, deviceId);
    const session = await this.sessionStore.getSession(address);
    return session !== null;
  }

  async getRegistrationId(): Promise<number> {
    return await this.identityStore.getLocalRegistrationId();
  }

  async getIdentityKeyPair(): Promise<{ privateKey: PrivateKey; publicKey: PublicKey }> {
    const privateKey = await this.identityStore.getIdentityKey();
    const publicKey = privateKey.getPublicKey();
    return { privateKey, publicKey };
  }

  async getUnusedPreKeyCount(): Promise<number> {
    // This is a custom helper method, not part of libsignal
    return await (this.preKeyStore as PreKeyStoreImpl).countPreKeys();
  }

  async replenishPreKeys(start: number, count: number): Promise<Array<{
    keyId: number;
    publicKey: Uint8Array;
  }>> {
    const identityKeyPair = await this.getIdentityKeyPair();
    const newPreKeys = await this.generatePreKeys(start, count);
    
    const publicKeys: Array<{ keyId: number; publicKey: Uint8Array }> = [];
    
    for (const preKey of newPreKeys) {
      const preKeyRecord = PreKeyRecord.new(
        preKey.keyId,
        preKey.keyPair.publicKey,
        preKey.keyPair.privateKey
      );
      await this.preKeyStore.savePreKey(preKey.keyId, preKeyRecord);
      publicKeys.push({
        keyId: preKey.keyId,
        publicKey: preKey.keyPair.publicKey.serialize()
      });
    }
    
    return publicKeys;
  }

  async rotateSignedPreKey(keyId: number): Promise<{
    keyId: number;
    publicKey: Uint8Array;
    signature: Uint8Array;
  }> {
    const identityKeyPair = await this.getIdentityKeyPair();
    const signedPreKey = await this.generateSignedPreKey(identityKeyPair.privateKey, keyId);
    
    const signedPreKeyRecord = SignedPreKeyRecord.new(
      signedPreKey.keyId,
      Date.now(),
      signedPreKey.keyPair.publicKey,
      signedPreKey.keyPair.privateKey,
      Buffer.from(signedPreKey.signature)
    );
    await this.signedPreKeyStore.saveSignedPreKey(
      signedPreKey.keyId,
      signedPreKeyRecord
    );

    return {
      keyId: signedPreKey.keyId,
      publicKey: signedPreKey.keyPair.publicKey.serialize(),
      signature: signedPreKey.signature
    };
  }
}