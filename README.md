# EfSec - Zero-Knowledge E2E Encryption

[![npm version](https://badge.fury.io/js/%40efchatnet%2Fefsec.svg)](https://badge.fury.io/js/%40efchatnet%2Fefsec)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

EfSec is a zero-knowledge end-to-end encryption library implementing the Matrix protocol's encryption standards. It provides secure, auditable cryptographic operations for real-time messaging applications.

## Features

- ✅ **Zero-Knowledge Architecture**: Private keys never leave the client
- ✅ **Matrix Protocol Compliant**: Uses vodozemac for standardized crypto
- ✅ **X3DH Key Exchange**: Secure session establishment
- ✅ **Double Ratchet**: Forward and backward secrecy for messages
- ✅ **Client-Side Storage**: Private keys stored in IndexedDB
- ✅ **TypeScript**: Fully typed API with comprehensive error handling

## Installation

```bash
npm install @efchatnet/efsec
```

## Quick Start

```typescript
import {
  initializeWasm,
  generateIdentityKeyPair,
  generateSignedPreKey,
  generateOneTimePreKeys,
  createOutboundSession,
  encryptMessage,
  decryptMessage,
  KeyStore
} from '@efchatnet/efsec';

// Initialize the WASM module
await initializeWasm();

// Generate keys for Alice
const aliceIdentity = await generateIdentityKeyPair();
const aliceSignedPreKey = await generateSignedPreKey(aliceIdentity.ed25519);

// Generate keys for Bob
const bobIdentity = await generateIdentityKeyPair();
const bobSignedPreKey = await generateSignedPreKey(bobIdentity.ed25519);
const bobOneTimeKeys = await generateOneTimePreKeys(50);

// Alice creates a session with Bob
const bobPreKeyBundle = {
  identityKey: bobIdentity.curve25519,
  signedPreKey: bobSignedPreKey.publicKey,
  oneTimePreKey: bobOneTimeKeys[0].publicKey,
  deviceId: 'bob-device-1',
  userId: 'bob'
};

const session = await createOutboundSession(aliceIdentity, bobPreKeyBundle);

// Alice encrypts a message
const message = {
  content: 'Hello, Bob!',
  timestamp: Date.now(),
  messageId: 'msg-123'
};

const encrypted = await encryptMessage(session, message);

// Bob decrypts the message
const decrypted = await decryptMessage(session, encrypted);
console.log(decrypted.content); // "Hello, Bob!"
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

### Key Generation

#### `generateIdentityKeyPair(): Promise<IdentityKeys>`
Generates a new identity key pair (Curve25519 and Ed25519).

#### `generateSignedPreKey(identityKey: PublicKey): Promise<KeyPair>`
Generates a signed prekey for key exchange.

#### `generateOneTimePreKeys(count?: number): Promise<KeyPair[]>`
Generates one-time prekeys. Default count is 50, maximum is 100.

### Session Management

#### `createOutboundSession(localKeys: IdentityKeys, remoteBundle: PreKeyBundle): Promise<Session>`
Creates an outbound session using X3DH key exchange.

#### `createInboundSession(localKeys: IdentityKeys, remoteIdentity: string, message: any): Promise<Session>`
Creates an inbound session from a prekey message.

### Message Encryption

#### `encryptMessage(session: Session, message: PlaintextMessage): Promise<EncryptedMessage>`
Encrypts a message using the Double Ratchet algorithm.

#### `decryptMessage(session: Session, encrypted: EncryptedMessage): Promise<PlaintextMessage>`
Decrypts an encrypted message.

### Storage

#### `KeyStore`
Provides IndexedDB-based storage for cryptographic keys and session state.

## Security Guarantees

- **Forward Secrecy**: Past messages remain secure even if current keys are compromised
- **Backward Secrecy**: Future messages are secure even if past keys are compromised
- **Authentication**: Messages are authenticated using digital signatures
- **Deniability**: Messages cannot be proven to have come from a specific sender
- **Zero-Knowledge Server**: Server never has access to private keys or plaintext

## Integration with EfChat

This library is designed to integrate with chat applications while maintaining complete separation between cryptographic operations and business logic:

```typescript
// In your chat application
import { EfSec } from '@efchatnet/efsec';

// Initialize E2E encryption
const efsec = new EfSec();
await efsec.initialize();

// Setup user keys on login
await efsec.setupUser(userId, deviceId);

// Encrypt messages before sending to server
const encrypted = await efsec.encryptDM(recipientId, plaintext);
websocket.send({ type: 'dm_encrypted', data: encrypted });

// Decrypt messages received from server
websocket.on('dm_encrypted', async (data) => {
  const decrypted = await efsec.decryptDM(data);
  displayMessage(decrypted);
});
```

## Error Handling

EfSec provides specific error types for different failure modes:

```typescript
import { DecryptionError, SessionError, KeyError } from '@efchatnet/efsec';

try {
  const decrypted = await decryptMessage(session, encrypted);
} catch (error) {
  if (error instanceof DecryptionError) {
    // Message could not be decrypted - possibly corrupted
    console.error('Decryption failed:', error.message);
  } else if (error instanceof SessionError) {
    // Session-related error - may be recoverable
    console.error('Session error:', error.message);
  } else if (error instanceof KeyError) {
    // Key-related error - usually not recoverable
    console.error('Key error:', error.message);
  }
}
```

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

MIT License - see [LICENSE](LICENSE) file for details.

## Security Audit

This library uses [vodozemac](https://github.com/matrix-org/vodozemac), which has been audited by Least Authority with no significant security findings.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.