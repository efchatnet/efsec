# EfSec - End-to-End Encryption Library

[![License: GPL-3.0+](https://img.shields.io/badge/License-GPL--3.0%2B-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Security: Audited](https://img.shields.io/badge/Security-Audited-green.svg)](#security)

**EfSec** is a comprehensive end-to-end encryption library implementing the Double Ratchet (Olm) and Megolm protocols for secure 1:1 messaging and group communication. Built with WebAssembly for browser compatibility while maintaining zero-knowledge server architecture.

## 🔒 Security Features

- **Zero-Knowledge Server**: Private keys never leave the client device
- **Double Ratchet Protocol**: Forward secrecy and post-compromise security for 1:1 messages
- **Megolm Protocol**: Efficient group messaging with perfect forward secrecy  
- **X3DH Key Exchange**: Secure key agreement for session initiation
- **Browser Compatible**: WebAssembly implementation works without native dependencies
- **Audited Implementation**: Built on [vodozemac](https://github.com/matrix-org/vodozemac) (audited by Least Authority)

## 🏗️ Architecture

### Protocol Stack
```
┌─────────────────────────────────────┐
│            efchat.net               │  ← Chat Application
├─────────────────────────────────────┤
│             EfSec                   │  ← This Library (PUBLIC & AUDITABLE)
│  ┌─────────────────────────────────┐ │
│  │        TypeScript API           │ │  ← High-level interface
│  ├─────────────────────────────────┤ │
│  │       WASM Bindings             │ │  ← Browser-compatible layer
│  ├─────────────────────────────────┤ │
│  │        vodozemac                │ │  ← Matrix's Rust implementation
│  │     (Olm + Megolm)              │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Storage Architecture

**Client-side (IndexedDB)** - Private Keys & Session State
- Account private keys
- Session ratchet state  
- Group session keys
- Message chains

**PostgreSQL** - Public Keys & Metadata
- Identity public keys
- One-time prekeys (until consumed)
- Signed prekeys
- Group session metadata

**Redis** - Ephemeral Encrypted Messages
- Encrypted messages in transit
- Temporary session state
- Delivery queues (TTL: 24h)

## 🚀 Quick Start

### Installation

```bash
npm install @efchatnet/efsec
```

### Basic Usage

```typescript
import { EfSecClient } from '@efchatnet/efsec';

// Initialize client (AUTHENTICATION REQUIRED)
const client = new EfSecClient('https://api.efchat.net');
await client.init(authToken, userId); // Only logged-in users can use E2E

// 1:1 Encrypted Messaging (Double Ratchet)
await client.startDMSession('user123');
const encrypted = await client.encryptDM('user123', 'Hello, secure world!');
const decrypted = await client.decryptDM('user123', encrypted);

// Group Encrypted Messaging (Megolm) 
await client.createGroup('group456');
const groupEncrypted = await client.encryptGroupMessage('group456', 'Hello, group!');
const groupDecrypted = await client.decryptGroupMessage('group456', senderId, 0, groupEncrypted);
```

### React/SolidJS Integration

```typescript
import { E2EProvider, useE2E } from '@efchatnet/efsec';

function App() {
  return (
    <E2EProvider 
      apiUrl="https://api.efchat.net"
      authToken={userToken}
      userId={userId}
      autoInitialize={true}
    >
      <EncryptedChat />
    </E2EProvider>
  );
}

function EncryptedChat() {
  const e2e = useE2E();
  
  const sendMessage = async (message: string) => {
    if (e2e.isInitialized()) {
      const encrypted = await e2e.sendEncryptedMessage(recipientId, message);
      // Message is automatically stored in Redis with TTL
    }
  };
  
  return <div>...</div>;
}
```

## 🔐 Protocol Compliance

### Double Ratchet (1:1 Messaging)

EfSec implements the complete Double Ratchet protocol as specified:

1. **X3DH Key Exchange**: Establishes initial shared secret
2. **Ratchet Initialization**: Creates message and receiving chains  
3. **Message Encryption**: Each message advances the ratchet
4. **Forward Secrecy**: Old keys are deleted after use
5. **Post-Compromise Security**: Recovery from key compromise

### Megolm (Group Messaging)

Efficient group messaging with perfect forward secrecy:

1. **Session Creation**: Group creator generates Megolm session
2. **Key Distribution**: Session key shared with group members
3. **Message Encryption**: Sender keys provide authenticity  
4. **Ratcheting**: Session advances with each message
5. **Member Management**: Handles joins/leaves with rekeying

### Key Management

**Identity Keys**
- Long-term Curve25519 keypair
- Stored permanently until device change
- Used for X3DH key exchange

**One-Time Prekeys**
- Ephemeral Curve25519 keypairs  
- Generated in batches (50 keys)
- Consumed once per session establishment
- Deleted after use (protocol requirement)

**Signed Prekeys**
- Medium-term Curve25519 keypair
- Signed with identity key
- Rotated periodically for security

## 🛡️ Security

### Audited Foundation

EfSec is built on [vodozemac](https://github.com/matrix-org/vodozemac), Matrix's Rust implementation of Olm and Megolm protocols, which has been [security audited by Least Authority](https://matrix.org/media/Least%20Authority%20-%20Matrix%20vodozemac%20Final%20Audit%20Report.pdf) with no significant findings.

### Zero-Knowledge Architecture

- **Private keys never leave the client device**
- Server only stores public keys and encrypted message metadata
- All decryption happens client-side in IndexedDB storage
- Authentication required - anonymous users cannot access E2E features

### Browser Security

- WebAssembly sandboxing provides memory safety
- IndexedDB provides persistent, encrypted local storage  
- CSP-compatible - no `eval()` or unsafe practices
- Works in all modern browsers without plugins

## 📡 API Reference

### Core Methods

#### `init(authToken: string, userId: string): Promise<void>`
Initialize E2E client with user authentication. **Required before any encryption operations**.

#### `startDMSession(userId: string): Promise<void>`  
Establish Double Ratchet session for 1:1 messaging using X3DH key exchange.

#### `encryptDM(userId: string, message: string): Promise<Uint8Array>`
Encrypt message using Double Ratchet. Automatically stores in Redis with TTL.

#### `decryptDM(userId: string, ciphertext: Uint8Array): Promise<string>`
Decrypt 1:1 message and advance ratchet state.

#### `createGroup(groupId: string): Promise<void>`
Create Megolm group session for encrypted group messaging.

#### `encryptGroupMessage(groupId: string, message: string): Promise<Uint8Array>`  
Encrypt group message using Megolm protocol.

#### `decryptGroupMessage(groupId: string, senderId: string, deviceId: number, ciphertext: Uint8Array): Promise<string>`
Decrypt group message and verify sender authenticity.

### Key Management

#### `getIdentityKeys(): string`
Get identity public keys for registration (JSON format).

#### `getOneTimeKeys(): string` 
Get available one-time prekeys for upload (JSON format).

#### `generateOneTimeKeys(count?: number): void`
Generate fresh one-time prekeys when running low.

## 🏃‍♂️ Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/efchatnet/efsec.git
cd efsec

# Install dependencies
make install

# Build WASM bindings
cd efsec-wasm
wasm-pack build --target web --out-dir pkg

# Build TypeScript client
cd ../client  
npm run build

# Run tests
make test
```

### Protocol Testing

```bash
# Test Double Ratchet implementation
npm run test:double-ratchet

# Test Megolm group messaging  
npm run test:megolm

# Test X3DH key exchange
npm run test:x3dh

# Integration tests with server
npm run test:integration
```

## 📋 Requirements

### Client Requirements
- Modern browser with WebAssembly support
- IndexedDB for persistent storage
- User authentication (anonymous users cannot use E2E)

### Server Requirements  
- PostgreSQL for public key storage
- Redis for ephemeral message storage
- Authentication middleware
- HTTPS/WSS for transport security

## 📄 License

Copyright (C) 2025 efchat.net

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

## 🤝 Contributing

EfSec is open source for security transparency and auditability. Contributions welcome:

1. Fork the repository
2. Create feature branch
3. Ensure tests pass
4. Submit pull request

### Security

For security issues, please email security@efchat.net with PGP key [available here](https://efchat.net/security.asc).

## 📚 Resources

- [Double Ratchet Specification](https://signal.org/docs/specifications/doubleratchet/)
- [X3DH Key Agreement](https://signal.org/docs/specifications/x3dh/)  
- [Megolm Group Messaging](https://gitlab.matrix.org/matrix-org/olm/-/blob/master/docs/megolm.md)
- [vodozemac Documentation](https://docs.rs/vodozemac/)
- [Matrix Protocol](https://spec.matrix.org/)