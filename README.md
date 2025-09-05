# efSec - End-to-End Encryption Security Module

A Signal Protocol implementation for efchat.net providing end-to-end encrypted messaging with zero-knowledge architecture.

## Features

- ✅ **Signal Double Ratchet Protocol** - Industry-standard E2E encryption
- ✅ **Zero-Knowledge Architecture** - Server never sees private keys or message content
- ✅ **Post-Quantum Resistance** - Kyber prekey support for quantum-resistant key exchange
- ✅ **Ephemeral Messaging** - DMs stored in Redis with TTL
- ✅ **Group Messaging** - Sender Keys protocol for efficient encrypted group chats
- ✅ **100% Signal Compliance** - Fully compliant with libsignal-client specifications

## Architecture

### Backend (Go)
- PostgreSQL for persistent key storage (public keys only)
- Redis for ephemeral DM storage with TTL
- RESTful API for key exchange and message routing
- Zero-knowledge design - no private keys or plaintext stored

### Frontend (TypeScript)
- libsignal-client for Signal protocol implementation
- IndexedDB for client-side key storage
- WebSocket support for real-time messaging
- SolidJS integration for efchat.net

## Database Schema

### PostgreSQL Tables

```sql
-- Identity keys (public only)
identity_keys (
    user_id VARCHAR(255) PRIMARY KEY,
    public_key BYTEA NOT NULL,
    registration_id INTEGER NOT NULL,
    created_at TIMESTAMP
)

-- Signed prekeys
signed_pre_keys (
    user_id VARCHAR(255),
    key_id INTEGER,
    public_key BYTEA NOT NULL,
    signature BYTEA NOT NULL,
    PRIMARY KEY (user_id, key_id)
)

-- One-time prekeys
one_time_pre_keys (
    user_id VARCHAR(255),
    key_id INTEGER,
    public_key BYTEA NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (user_id, key_id)
)

-- Kyber prekeys (post-quantum)
kyber_pre_keys (
    user_id VARCHAR(255),
    key_id INTEGER,
    public_key BYTEA NOT NULL,
    signature BYTEA NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (user_id, key_id)
)

-- Sender keys (group encryption)
sender_keys (
    group_id VARCHAR(255),
    user_id VARCHAR(255),
    public_signature_key BYTEA NOT NULL,
    key_version INTEGER DEFAULT 1,
    PRIMARY KEY (group_id, user_id)
)
-- Note: Chain keys are NEVER stored on server

-- E2E spaces
e2e_spaces (
    space_id VARCHAR(255) PRIMARY KEY,
    space_type VARCHAR(20),
    is_e2e_enabled BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(255),
    member_count INTEGER DEFAULT 2
)

-- DM spaces
dm_spaces (
    space_id VARCHAR(255) PRIMARY KEY,
    user1_id VARCHAR(255),
    user2_id VARCHAR(255),
    UNIQUE (user1_id, user2_id)
)
```

### Redis Storage

```
# Direct Messages
dm:{message_id} -> {
    sender_id, recipient_id, ciphertext, 
    message_type, timestamp
}
TTL: 7 days (regular), 24 hours (key distribution)

# Unread messages per user
dm:unread:{user_id} -> Set of message IDs

# Message indices
dm:user:{user_id} -> Sorted set of message IDs by timestamp
dm:between:{user1}:{user2} -> Sorted set of message IDs
```

## API Endpoints

### Key Management

#### Register Initial Keys
```http
POST /api/e2e/keys
Authorization: Bearer {token}
Content-Type: application/json

{
    "registration_id": 12345,
    "identity_public_key": [/* bytes */],
    "signed_pre_key": {
        "id": 1,
        "public_key": [/* bytes */],
        "signature": [/* bytes */]
    },
    "one_time_pre_keys": [
        {"id": 2, "public_key": [/* bytes */]},
        // ... up to 100 keys
    ],
    "kyber_pre_keys": [
        {"id": 1, "public_key": [/* bytes */], "signature": [/* bytes */]},
        // ... optional post-quantum keys
    ]
}

Response: 200 OK
{
    "status": "keys registered"
}
```

#### Get Prekey Bundle
```http
GET /api/e2e/bundle/{user_id}
Authorization: Bearer {token}

Response: 200 OK
{
    "registration_id": 12345,
    "identity_public_key": [/* bytes */],
    "signed_pre_key": {
        "id": 1,
        "public_key": [/* bytes */],
        "signature": [/* bytes */]
    },
    "one_time_pre_key": {
        "id": 42,
        "public_key": [/* bytes */]
    },
    "kyber_pre_key": {
        "id": 1,
        "public_key": [/* bytes */],
        "signature": [/* bytes */]
    }
}
```

#### Replenish Prekeys
```http
POST /api/e2e/keys/replenish
Authorization: Bearer {token}
Content-Type: application/json

{
    "one_time_pre_keys": [
        {"id": 101, "public_key": [/* bytes */]},
        // ... new prekeys
    ],
    "kyber_pre_keys": [
        {"id": 2, "public_key": [/* bytes */], "signature": [/* bytes */]}
    ]
}

Response: 200 OK
{
    "added": 100
}
```

### Direct Messages

#### Send Encrypted DM
```http
POST /api/e2e/dm/send
Authorization: Bearer {token}
Content-Type: application/json

{
    "recipient_id": "user123",
    "ciphertext": "base64_encrypted_data",
    "message_type": 3,  // CiphertextMessageType
    "ephemeral": true,  // Optional: shorter TTL
    "device_id": 1
}

Response: 200 OK
{
    "message_id": "msg_abc123",
    "timestamp": "2025-01-05T10:30:00Z"
}
```

#### Get DMs
```http
GET /api/e2e/dm/messages?limit=50
Authorization: Bearer {token}

Response: 200 OK
{
    "messages": [
        {
            "message_id": "msg_abc123",
            "sender_id": "user456",
            "ciphertext": "base64_encrypted_data",
            "message_type": 3,
            "timestamp": "2025-01-05T10:30:00Z",
            "device_id": 1
        }
    ]
}
```

#### Get DMs Between Users
```http
GET /api/e2e/dm/messages/between/{user_id}?limit=50
Authorization: Bearer {token}

Response: 200 OK
{
    "messages": [/* encrypted messages */]
}
```

### Spaces

#### Create E2E DM Space
```http
POST /api/e2e/spaces/dm
Authorization: Bearer {token}
Content-Type: application/json

{
    "peer_id": "user456"
}

Response: 200 OK
{
    "space_id": "space_xyz789",
    "peer_id": "user456",
    "e2e_enabled": true
}
```

#### Get User's Spaces
```http
GET /api/e2e/spaces
Authorization: Bearer {token}

Response: 200 OK
{
    "spaces": [
        {
            "space_id": "space_xyz789",
            "type": "dm",
            "peer_id": "user456",
            "e2e_enabled": true,
            "last_message_at": "2025-01-05T10:30:00Z"
        }
    ]
}
```

### Group Messaging

#### Create Group
```http
POST /api/e2e/groups
Authorization: Bearer {token}
Content-Type: application/json

{
    "group_id": "group123",
    "member_ids": ["user1", "user2", "user3"]
}

Response: 200 OK
{
    "group_id": "group123"
}
```

#### Join Group
```http
POST /api/e2e/groups/{group_id}/join
Authorization: Bearer {token}
Content-Type: application/json

{
    "public_signature_key": [/* bytes */],
    "key_version": 1
}

Response: 200 OK
{
    "status": "joined"
}
```

#### Get Group Keys
```http
GET /api/e2e/groups/{group_id}/keys
Authorization: Bearer {token}

Response: 200 OK
{
    "group_id": "group123",
    "members": ["user1", "user2", "user3"],
    "sender_keys": [
        {
            "user_id": "user1",
            "public_signature_key": [/* bytes */],
            "key_version": 1
        }
    ]
}
```

#### Send Group Message
```http
POST /api/e2e/groups/{group_id}/message
Authorization: Bearer {token}
Content-Type: application/json

{
    "ciphertext": [/* bytes */],
    "signature": [/* bytes */],
    "key_version": 1
}

Response: 201 Created
{
    "message_id": "msg_123456"
}
```

## Frontend Integration

### Initialize Signal Protocol
```typescript
import { SignalManager } from '@efchatnet/efsec/client';

const signalManager = new SignalManager({
    apiUrl: 'https://api.efchat.net',
    authToken: 'user_auth_token',
    userId: 'current_user_id'
});

await signalManager.initialize();
```

### Send Encrypted Message
```typescript
// Automatically establishes session if needed
const encrypted = await signalManager.encryptMessage(
    'recipient_user_id',
    'Hello, this is encrypted!',
    1 // device ID
);

// Send via API
await sendEncryptedDM(encrypted);
```

### Decrypt Received Message
```typescript
const plaintext = await signalManager.decryptMessage(
    'sender_user_id',
    encryptedData,
    messageType,
    1 // device ID
);

console.log('Decrypted:', plaintext);
```

### Group Messaging
```typescript
const groupManager = signalManager.getGroupManager();

// Join group and distribute keys
await groupManager.joinGroup('group123');

// Encrypt for group
const encrypted = await groupManager.encryptForGroup(
    'group123',
    'Hello group!'
);

// Decrypt group message
const plaintext = await groupManager.decryptGroupMessage(
    'group123',
    'sender_id',
    encryptedData
);
```

## Security Considerations

### Zero-Knowledge Architecture
The server never has access to:
- **Private keys** - Stored only in client IndexedDB
- **Chain keys** - Never sent to server (critical for security)
- **Plaintext messages** - Encrypted end-to-end
- **Session state** - Maintained only on clients

### Key Security Features
1. **Perfect Forward Secrecy** - Each message uses new ephemeral keys
2. **Post-Quantum Resistance** - Optional Kyber prekeys for quantum-safe key exchange
3. **Ephemeral Storage** - DMs auto-expire from Redis:
   - Regular messages: 7 days
   - Key distribution: 24 hours
4. **Trust On First Use (TOFU)** - Identity keys trusted on first contact
5. **Signal Protocol Compliance** - 100% compliant with libsignal-client specifications

## Installation

### Backend Setup

#### Prerequisites
- PostgreSQL >= 12.0
- Redis >= 6.0
- Go >= 1.21

#### Installation
```bash
# Clone repository
git clone --recursive https://github.com/efchatnet/efsec.git
cd efsec

# Install Go dependencies
cd backend
go mod download

# Setup database
createdb efsec
# Migrations run automatically on startup

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run server
go run cmd/server/main.go
```

### Frontend Setup

```bash
# Install package
npm install @efchatnet/efsec

# Or with Yarn
yarn add @efchatnet/efsec

# Or with Bun
bun add @efchatnet/efsec
```

## Environment Variables

### Backend
```env
DATABASE_URL=postgres://user:pass@localhost/efsec
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
PORT=8080
```

### Frontend
```env
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080
```

## Docker Deployment

### Using Docker Compose
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: efsec
      POSTGRES_USER: efsec
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  efsec:
    build: .
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: postgres://efsec:${DB_PASSWORD}@postgres:5432/efsec
      REDIS_URL: redis:6379
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
  redis_data:
```

## Development

### Running Tests
```bash
# Backend tests
cd backend
go test ./...

# Frontend tests
cd client
bun test
```

### Type Checking
```bash
# TypeScript
cd client
npx tsc --noEmit
```

## License

Copyright (C) 2025 efchat.net

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.