# EfSec - Matrix Protocol E2E Encryption

[![npm version](https://badge.fury.io/js/efsec.svg)](https://badge.fury.io/js/efsec)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%20v3+-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

EfSec is a zero-knowledge end-to-end encryption library that provides a high-level TypeScript interface to the Matrix protocol's encryption standards. Built on top of `@matrix-org/matrix-sdk-crypto-wasm`, it offers both convenience wrappers and direct access to the underlying Matrix cryptographic primitives.

## Features

- ✅ **Matrix Protocol Compliant**: Full compliance with Matrix E2E encryption specification
- ✅ **Dual API Approach**: High-level wrappers + direct Matrix SDK access for flexibility
- ✅ **Zero-Knowledge Architecture**: Private keys never leave the client device
- ✅ **Olm & Megolm**: Device-to-device (Olm) and group messaging (Megolm) support
- ✅ **X3DH Key Exchange**: Secure initial session establishment
- ✅ **Double Ratchet**: Forward and backward secrecy for all messages
- ✅ **Secure Storage**: IndexedDB-based key storage via Matrix SDK
- ✅ **TypeScript**: Fully typed API with comprehensive error handling
- ✅ **Audited Crypto**: Built on Matrix's audited `@matrix-org/matrix-sdk-crypto-wasm`

## Installation

```bash
npm install efsec
```

## Quick Start

### High-Level API (Recommended)

```typescript
import {
  initializeWasm,
  generateIdentityKeyPair,
  generateOneTimePreKeys,
  createOutboundSession,
  encryptMessage,
  decryptMessage,
  KeyStore
} from 'efsec';

// Initialize the Matrix crypto WASM module
await initializeWasm();

// Generate Matrix-compliant identity keys
const identityKeys = await generateIdentityKeyPair();
console.log('Curve25519:', identityKeys.curve25519.key);
console.log('Ed25519:', identityKeys.ed25519.key);

// Generate one-time prekeys for X3DH
const oneTimeKeys = await generateOneTimePreKeys(50);

// Create secure storage for keys
const keyStore = new KeyStore();
await keyStore.initialize();
await keyStore.storeIdentityKeys('device-1', identityKeys);

// Create session and encrypt messages
const session = await createOutboundSession(identityKeys, recipientBundle);
const message = { content: 'Hello!', timestamp: Date.now(), messageId: 'msg-1' };
const encrypted = await encryptMessage(session, message);
const decrypted = await decryptMessage(session, encrypted);
```

### Direct Matrix SDK Access

For applications needing full Matrix protocol control:

```typescript
import * as MatrixCrypto from '@matrix-org/matrix-sdk-crypto-wasm';

// Initialize Matrix SDK directly
await MatrixCrypto.initAsync();

// Create OlmMachine for your user
const olmMachine = await MatrixCrypto.OlmMachine.initialize(
  new MatrixCrypto.UserId('@user:domain.com'),
  new MatrixCrypto.DeviceId('DEVICE123')
);

// Get identity keys from Matrix SDK
const identityKeys = olmMachine.identityKeys;
const curve25519 = identityKeys.curve25519.toBase64();
const ed25519 = identityKeys.ed25519.toBase64();

// Generate keys through outgoing requests
const requests = await olmMachine.outgoingRequests();
// Handle key upload, query, and claim requests...
```

## Key Storage

EfSec provides secure client-side key storage using IndexedDB:

```typescript
import { KeyStore } from '@efchatnet/efsec';

const keyStore = new KeyStore();
await keyStore.initialize();

// Store keys
const deviceId = 'my-device-1';
const identityKeys = await generateIdentityKeyPair();
await keyStore.storeIdentityKeys(deviceId, identityKeys);

// Retrieve keys
const storedKeys = await keyStore.getIdentityKeys(deviceId);

// Export/import for backup
const backup = await keyStore.exportData(deviceId);
// ... store backup securely ...
await keyStore.importData(backup);
```

## API Reference

### Core Functions

#### `initializeWasm(): Promise<void>`
Initializes the Matrix crypto WASM module. Must be called before any other functions.

#### `generateIdentityKeyPair(): Promise<IdentityKeys>`
Generates Matrix-compliant identity keys (Curve25519 and Ed25519) using the Matrix SDK.

#### `generateOneTimePreKeys(count?: number): Promise<KeyPair[]>`
Generates one-time prekeys through the Matrix SDK's OlmMachine. Returns available keys from outgoing upload requests.

### Session Management

#### `createOutboundSession(localKeys: IdentityKeys, remoteBundle: PreKeyBundle): Promise<Session>`
Creates an outbound session using X3DH key exchange protocol.

#### `encryptMessage(session: Session, message: PlaintextMessage): Promise<EncryptedMessage>`
Encrypts a message using Double Ratchet (Olm) or Megolm encryption.

#### `decryptMessage(session: Session, encrypted: EncryptedMessage): Promise<PlaintextMessage>`
Decrypts encrypted messages while maintaining forward secrecy.

### Group Messaging (Megolm)

#### `createOutboundGroupSession(): Promise<OutboundGroupSession>`
Creates a new Megolm group session for encrypting messages to multiple recipients.

#### `createInboundGroupSessionFromKey(sessionKey: string): Promise<InboundGroupSession>`
Creates an inbound group session from a shared session key.

### Storage

#### `KeyStore`
Secure IndexedDB-based storage for cryptographic keys and session state, designed for Matrix protocol compliance.

### Matrix SDK Integration

EfSec also re-exports the complete `@matrix-org/matrix-sdk-crypto-wasm` API for direct access when needed. This allows applications to use Matrix SDK primitives directly while maintaining compatibility with EfSec's higher-level abstractions.

## Security Guarantees

- **Forward Secrecy**: Past messages remain secure even if current keys are compromised
- **Backward Secrecy**: Future messages are secure even if past keys are compromised
- **Authentication**: Messages are authenticated using digital signatures
- **Deniability**: Messages cannot be proven to have come from a specific sender
- **Zero-Knowledge Server**: Server never has access to private keys or plaintext

## Architecture & Design Philosophy

EfSec follows a dual-layer architecture:

1. **High-Level API**: Convenient wrapper functions for common E2E encryption tasks
2. **Matrix SDK Access**: Direct access to `@matrix-org/matrix-sdk-crypto-wasm` for full protocol control

This design allows applications to:
- Start with simple wrapper functions for quick integration
- Graduate to direct Matrix SDK usage for advanced features
- Maintain Matrix protocol compliance throughout the transition

### Integration Example

```typescript
import { initializeWasm, generateIdentityKeyPair, KeyStore } from 'efsec';
import * as MatrixCrypto from '@matrix-org/matrix-sdk-crypto-wasm';

// Initialize
await initializeWasm();

// High-level API for simple tasks
const identityKeys = await generateIdentityKeyPair();
const keyStore = new KeyStore();
await keyStore.storeIdentityKeys('device-1', identityKeys);

// Direct Matrix SDK for advanced features
const olmMachine = await MatrixCrypto.OlmMachine.initialize(
  new MatrixCrypto.UserId('@user:example.com'),
  new MatrixCrypto.DeviceId('DEVICE123')
);

// Handle key upload requests
const requests = await olmMachine.outgoingRequests();
for (const request of requests) {
  if (request.type === MatrixCrypto.RequestType.KeysUpload) {
    // Send request.body to your Matrix server
    const response = await fetch('/matrix/keys/upload', {
      method: 'POST',
      body: request.body
    });
    await olmMachine.markRequestAsSent(request.id, request.type, await response.text());
  }
}
```

## Error Handling

EfSec provides specific error types for different failure modes:

```typescript
import { DecryptionError, SessionError, KeyError } from 'efsec';

try {
  const decrypted = await decryptMessage(session, encrypted);
} catch (error) {
  if (error instanceof DecryptionError) {
    // Message could not be decrypted - possibly corrupted or wrong session
    console.error('Decryption failed:', error.message);
  } else if (error instanceof SessionError) {
    // Session-related error - may need to re-establish session
    console.error('Session error:', error.message);
  } else if (error instanceof KeyError) {
    // Key-related error - usually requires key regeneration
    console.error('Key error:', error.message);
  }
}
```

### Common Error Scenarios

- **DecryptionError**: Wrong session, corrupted message, or missing keys
- **SessionError**: Session state corruption or protocol violations
- **KeyError**: Missing identity keys, invalid key format, or key generation failure

## Browser Compatibility

EfSec requires modern browser features:
- IndexedDB (for key storage)
- Web Crypto API (for cryptographic operations)
- WebAssembly (for vodozemac)
- ES2022 modules

Supported browsers:
- Chrome 88+
- Firefox 90+
- Safari 14+
- Edge 88+

## License

GNU General Public License v3.0 or later - see [LICENSE](LICENSE) file for details.

This software is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

## Security & Auditing

EfSec builds on Matrix's battle-tested cryptographic implementations:

- **Matrix SDK Crypto**: Uses `@matrix-org/matrix-sdk-crypto-wasm` directly
- **Vodozemac**: Underlying Rust implementation audited by Least Authority
- **Matrix Protocol**: Extensively peer-reviewed E2E encryption specification
- **Zero Server Knowledge**: Cryptographic operations are client-side only

Security researchers are encouraged to audit EfSec's wrapper layer, though the core cryptographic operations are handled by the audited Matrix SDK.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.