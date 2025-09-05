# efsec
End-to-End Encryption Module for efchat using Signal Protocol

## Overview
This repository contains all E2E encryption code for efchat, implementing the Signal Protocol for both 1:1 direct messages and group chats. The code is separated from the main application for security auditing purposes.

## Architecture

### Security Principles
- **Zero-Knowledge Backend**: Server only stores public keys, never sees private keys or plaintext
- **Client-Side Encryption**: All cryptographic operations happen on the client
- **Verifiable Source**: libsignal included as git submodule for build verification

### Components

#### Backend (Go)
- REST API for key management
- PostgreSQL storage for public keys
- Group management with Sender Keys
- Zero-knowledge message relay

#### Client (TypeScript)
- Signal Protocol wrapper (X3DH + Double Ratchet)
- Sender Keys for group E2E
- IndexedDB for secure key storage
- Session management

## Integration with efchat

### Backend Integration
```go
import "github.com/efchatnet/efsec/backend/integration"

// In your main.go or router setup
e2e, err := integration.NewE2EIntegration(db, redisClient)
if err != nil {
    log.Fatal(err)
}

// Register E2E routes with your existing router
e2e.RegisterRoutes(router, yourAuthMiddleware)
```

### Frontend Integration
```typescript
import { EfSecClient } from '@efchat/efsec';

// Initialize E2E client
const e2e = new EfSecClient('https://api.efchat.net');
await e2e.init(authToken);

// Start DM session
await e2e.startDMSession(recipientUserId);

// Encrypt message
const encrypted = await e2e.encryptDM(recipientUserId, messageText);

// Decrypt received message
const plaintext = await e2e.decryptDM(senderId, encryptedData);
```

## Key Management Tasks
- Ensure keys are generated and stored securely on the client (never send private keys to the server).
- Regenerate one-time prekeys periodically (after use) and upload new batches.

## Frontend
- Use official signal protocol library
- Generate all keys on client device - zero knowledge to the backend

## Backend
- No cryptography on backend, only redis/db storage of public keys (base64)

## Client Key Storage
- Use IndexedDB for persistent key storage to avoid LocalStorage attack vector

## Schema
- Required tables or models:
  - identity_keys:
    - user_id
    - public_key (byte array)
    - registration_id (int)
  - signed_pre_keys:
    - user_id
    - prekey_id (int)
    - public_key (byte array)
    - signature (byte array)
  - one_time_pre_keys:
    - user_id
    - prekey_id (int)
    - public_key (byte array)
    - used (boolean - default false, flip to true when used)

## API Routes
- POST event to register keys
     {
      registration_id, // client generated
      identity_public_key, //
      signed_pre_key: { id, public_key, signature},
      one_time_pre_key: [{id, public_key}, ... batching ...]
    }

- GET event to pull pre-key objects

RETURNS a pre key that still has the 'false' one_time_pre_keys.used boolean flag, mark as 'true' when sent:
  {
    identity_public_key,
    signed_pre_key: { id, public_key, signature},
    one_time_pre_key: {id, public_key}
  }

### Error handling
- no unused prekeys remaining for client, client should generate and send more (batching)
