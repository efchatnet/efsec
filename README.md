# EfSec - End-to-End Encryption Library

[![License: GPL-3.0+](https://img.shields.io/badge/License-GPL--3.0+-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Version](https://img.shields.io/badge/Version-0.1.2-green.svg)](https://github.com/efchatnet/efsec)
[![Security: Matrix Protocol](https://img.shields.io/badge/Security-Matrix%20Protocol-orange.svg)](#protocol-implementation)
[![WASM: vodozemac](https://img.shields.io/badge/WASM-vodozemac-purple.svg)](https://github.com/matrix-org/vodozemac)
[![Database: PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-blue.svg)](#storage-architecture)
[![Cache: Redis](https://img.shields.io/badge/Cache-Redis-red.svg)](#ephemeral-storage)
[![Registry: GitHub Packages](https://img.shields.io/badge/Registry-GitHub%20Packages-lightgrey.svg)](https://npm.pkg.github.com)

**EfSec** is a production-ready end-to-end encryption library implementing the Double Ratchet (Olm) and Megolm protocols for secure 1:1 messaging and group communication. Built on Matrix's audited vodozemac WASM implementation with zero-knowledge server architecture.

## 📦 Package Information

```bash
npm install @efchatnet/efsec
```

**Package:** `@efchatnet/efsec@0.1.2`  
**Registry:** GitHub Packages (`https://npm.pkg.github.com`)  
**Module Type:** ESM (ECMAScript Modules)  
**License:** GPL-3.0-or-later  
**Node Requirements:** >=18.0.0

## 🏗️ Implementation Architecture

### Core Design Philosophy

EfSec follows a **zero-knowledge server architecture** where:
- Private keys **never leave the client device**
- Server stores **only public keys** and encrypted message metadata
- All encryption/decryption happens **client-side in IndexedDB**
- Authentication is **mandatory** - anonymous users cannot access E2E features

### Protocol Stack Implementation

```
┌─────────────────────────────────────┐
│         efchat.net Client           │  ← Chat Application Layer
├─────────────────────────────────────┤
│          EfSecClient API            │  ← TypeScript High-Level Interface
│  ┌─────────────────────────────────┐ │
│  │     Dynamic WASM Loading        │ │  ← Browser-Compatible Layer
│  ├─────────────────────────────────┤ │
│  │       vodozemac WASM            │ │  ← Matrix's Rust Implementation
│  │  (Double Ratchet + Megolm)     │ │    (Audited by Least Authority)
│  └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│        Storage Abstraction          │
│  ┌─────────────────────────────────┐ │
│  │     IndexedDB (Client)          │ │  ← Private Keys & Session State
│  ├─────────────────────────────────┤ │
│  │     PostgreSQL (Server)         │ │  ← Public Keys & Metadata
│  ├─────────────────────────────────┤ │
│  │     Redis (Ephemeral)           │ │  ← Encrypted Messages (TTL: 24h)
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Detailed Storage Architecture

#### Client-Side Storage (IndexedDB)
**Database:** `efsec_keys_${userId}` (per-user isolation)

**Object Stores:**
- `account`: User's cryptographic identity and key generation state
- `sessions`: Double Ratchet session state for 1:1 messaging
- `groupSessions`: Megolm session state for group messaging

**Security Properties:**
- Private keys never serialized to server
- Perfect forward secrecy maintained through client-side ratcheting
- Post-compromise security through key deletion after use

#### Server-Side Storage (PostgreSQL)
**Tables (created by backend migrations):**
- `identity_keys`: Long-term public identity keys (Curve25519/Ed25519)
- `signed_pre_keys`: Signed prekeys with rotation support
- `one_time_pre_keys`: Ephemeral prekeys consumed once per X3DH exchange
- `group_sessions`: Megolm session metadata for group key distribution

**Security Properties:**
- **Zero-knowledge**: Server never sees private keys or plaintext
- Public keys stored permanently for X3DH key exchange protocol
- One-time keys marked as `used` after consumption (protocol requirement)

#### Ephemeral Storage (Redis)
**Purpose:** Encrypted message relay and temporary session coordination
- Encrypted messages in transit (TTL: 24 hours)
- Group session distribution queues
- Delivery acknowledgment tracking

**Security Properties:**
- Only encrypted payloads stored
- Automatic expiration prevents data accumulation
- No cryptographic keys stored in Redis

## 🔐 Protocol Implementation Details

### Double Ratchet (1:1 Messaging) - RFC Compliant

**Implementation Location:** `client/src/index.ts:310-392`

```typescript
// X3DH Key Exchange Protocol
const keyBundle = await this.fetchKeyBundle(userId);
const session = this.account.create_outbound_session(
  identityKeys.curve25519,  // Long-term identity
  oneTimeKey               // Ephemeral key (consumed once)
);

// Double Ratchet Message Encryption
const ciphertext = session.encrypt(message);
await this.storeSession(userId, session); // Advance ratchet state
```

**Protocol Phases:**
1. **X3DH Key Exchange**: Establishes initial shared secret using recipient's identity key and one-time prekey
2. **Ratchet Initialization**: Creates separate message chains for sending/receiving
3. **Message Encryption**: Each message advances the ratchet, providing forward secrecy
4. **Key Deletion**: Old keys automatically deleted after use per protocol requirement
5. **Recovery**: Post-compromise security through automatic rekeying

### Megolm (Group Messaging) - Matrix Protocol

**Implementation Location:** `client/src/index.ts:394-454`

```typescript
// Megolm Outbound Session Creation
const outboundSession = new EfSecOutboundGroupSession();
const sessionKey = outboundSession.session_key();

// Group Message Encryption
const ciphertext = outboundSession.encrypt(message);
await this.storeEphemeralMessage(recipients, ciphertext, 'group');
```

**Group E2E Process:**
1. **Session Creation**: Group creator generates Megolm outbound session
2. **Key Distribution**: Session key distributed to members via 1:1 Double Ratchet
3. **Message Encryption**: Sender keys provide authenticity and forward secrecy
4. **Ratcheting**: Session advances with each message for perfect forward secrecy
5. **Member Management**: Rekeying on membership changes (joins/leaves)

### Key Management Implementation

**Identity Key Generation:** `client/src/index.ts:210-260`
```typescript
// Long-term Curve25519 keypair for X3DH
this.account = new EfSecAccount();
const identityKeys = JSON.parse(this.account.identity_keys);
```

**One-Time Prekey Management:** `client/src/index.ts:240`
```typescript
// Generate 50 prekeys per protocol recommendation
this.account.generate_one_time_keys(50);
await this.registerPublicKeys(); // Upload to PostgreSQL
```

**Session Key Ratcheting:** Automatic per-message advancement
- Receiving chain keys deleted after successful decryption
- Sending chain keys deleted after message encryption
- Provides forward secrecy and post-compromise security

## 🚀 Implementation Usage

### Basic Client Implementation

```typescript
import { EfSecClient } from '@efchatnet/efsec';

// Initialize with authentication (REQUIRED)
const client = new EfSecClient('https://api.efchat.net');
await client.init(authToken, userId);

// 1:1 Encrypted Messaging (Double Ratchet)
await client.startDMSession('user123');
const encrypted = await client.encryptDM('user123', 'Hello, secure world!');
const decrypted = await client.decryptDM('user123', encrypted);

// Group Encrypted Messaging (Megolm)
await client.createGroup('group456');
const groupEncrypted = await client.encryptGroupMessage('group456', 'Hello, group!');
const groupDecrypted = await client.decryptGroupMessage('group456', senderId, 0, groupEncrypted);
```

### Integration with efchat Backend

**Go Integration:** `backend/integration/efchat.go`
```go
integration := NewE2EIntegration(db, redis)
router.PathPrefix("/api/e2e").Handler(integration)
```

**REST API Endpoints:**
- `POST /api/e2e/keys` - Register public key bundle
- `GET /api/e2e/bundle/{userId}` - Fetch X3DH key bundle
- `POST /api/e2e/messages/ephemeral` - Store encrypted message in Redis
- `POST /api/e2e/groups/{groupId}/session-key` - Register Megolm session

## 🛠️ Development Implementation

### Build System (GNU Makefile)

```bash
# Complete build with verification
make all

# Verify vodozemac authenticity (recommended)
make verify

# Code quality (linting, formatting)
make lint

# Multi-target WASM build
make build-wasm

# TypeScript client build
make build-client

# Run comprehensive tests
make test
```

### Multi-Target WASM Build

**Build Targets:**
- `pkg-web/`: iOS Safari, Android Chrome, PWAs
- `pkg-bundler/`: React Native, Electron applications  
- `pkg-nodejs/`: Server-side rendering (SSR)

**Build Process:**
```bash
cd efsec-wasm
wasm-pack build --target web --out-dir pkg-web
wasm-pack build --target bundler --out-dir pkg-bundler  
wasm-pack build --target nodejs --out-dir pkg-nodejs
```

### Testing Implementation

**WASM Tests:**
```bash
cd efsec-wasm && wasm-pack test --headless --firefox
```

**TypeScript Tests:**
```bash
cd client && bun test
```

**Integration Tests:**
- Double Ratchet protocol compliance
- Megolm group messaging correctness
- X3DH key exchange verification
- Cross-platform WASM compatibility

## 📋 Implementation Requirements

### Client Requirements
- **Browser:** Modern browser with WebAssembly support
- **Storage:** IndexedDB for persistent private key storage
- **Auth:** User authentication token (anonymous users blocked)
- **Node:** >=18.0.0 for development

### Server Requirements (Backend)
- **Database:** PostgreSQL for public key permanence
- **Cache:** Redis for ephemeral message storage
- **Auth:** Authentication middleware integration
- **Transport:** HTTPS/WSS for transport layer security

### Mobile Compatibility
- **iOS:** Safari 15+ with WASM support
- **Android:** Chrome 89+ with WASM support
- **React Native:** Bundler target with Hermes engine
- **Cross-platform:** Consistent API across all targets

## 🔒 Security Implementation

### Audited Foundation
Built on [vodozemac](https://github.com/matrix-org/vodozemac), Matrix's Rust implementation of Olm/Megolm protocols, [audited by Least Authority](https://matrix.org/media/Least%20Authority%20-%20Matrix%20vodozemac%20Final%20Audit%20Report.pdf) with no significant security findings.

### Zero-Knowledge Implementation
- **Private Key Isolation**: Keys generated and stored only in client IndexedDB
- **Server Blindness**: Server processes only public keys and encrypted metadata  
- **Authentication Gate**: Anonymous users cannot access E2E features
- **Protocol Compliance**: Follows Signal/Matrix specifications exactly

### Browser Security Model
- **WASM Sandboxing**: Memory safety through WebAssembly execution
- **IndexedDB Encryption**: Persistent storage with browser security model
- **CSP Compliance**: No `eval()` or unsafe practices
- **Universal Support**: Works across all modern browsers

## 📡 API Implementation Reference

### Core Initialization
```typescript
init(authToken: string, userId: string): Promise<void>
```
Initialize E2E client with mandatory user authentication.

### Double Ratchet Implementation
```typescript
startDMSession(userId: string): Promise<void>
encryptDM(userId: string, message: string): Promise<Uint8Array>  
decryptDM(userId: string, ciphertext: Uint8Array): Promise<string>
```
Protocol-compliant X3DH key exchange and Double Ratchet messaging.

### Megolm Implementation  
```typescript
createGroup(groupId: string): Promise<void>
encryptGroupMessage(groupId: string, message: string): Promise<Uint8Array>
decryptGroupMessage(groupId: string, senderId: string, deviceId: number, ciphertext: Uint8Array): Promise<string>
```
Matrix-compliant Megolm group session management and encryption.

### Key Management Implementation
```typescript
getIdentityKeys(): string
getOneTimeKeys(): string
generateOneTimeKeys(count?: number): void
```
Protocol-compliant key generation and rotation.

## 📄 License

Copyright (C) 2025 efchat.net <tj@efchat.net>

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.

## 🔗 Implementation Resources

- **Double Ratchet Specification**: https://signal.org/docs/specifications/doubleratchet/
- **X3DH Key Agreement**: https://signal.org/docs/specifications/x3dh/
- **Megolm Group Messaging**: https://gitlab.matrix.org/matrix-org/olm/-/blob/master/docs/megolm.md
- **vodozemac Documentation**: https://docs.rs/vodozemac/
- **Matrix Protocol Specification**: https://spec.matrix.org/
- **Least Authority Audit**: https://matrix.org/media/Least%20Authority%20-%20Matrix%20vodozemac%20Final%20Audit%20Report.pdf