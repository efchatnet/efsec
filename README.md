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

## Installation

### Prerequisites

| Component | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | >= 12.0 | Key storage database |
| Redis | >= 6.0 | Caching and temporary data |
| Node.js | >= 18.0 | Client library build |
| Go | >= 1.21 | Backend server |
| libsignal | Submodule | Signal Protocol implementation |

### Backend Installation

#### Step 1: Clone with Submodules
```bash
git clone --recursive https://github.com/efchatnet/efsec.git
cd efsec

# If already cloned without submodules
git submodule update --init --recursive
```

#### Step 2: Verify libsignal Source
```bash
make verify
# Output: ✓ libsignal verified from official Signal repository
```

#### Step 3: Install Dependencies
```bash
# Go dependencies
go mod download

# Client dependencies
cd client && npm install && cd ..
```

#### Step 4: Database Setup
```sql
-- Create database
CREATE DATABASE efsec;

-- Grant permissions (adjust username)
GRANT ALL PRIVILEGES ON DATABASE efsec TO your_app_user;
```

#### Step 5: Configure Environment
```bash
# .env file
DATABASE_URL=postgres://username:password@localhost:5432/efsec?sslmode=require
REDIS_URL=localhost:6379
PORT=8081
JWT_SECRET=your-jwt-secret-matching-efchat
```

#### Step 6: Run Migrations
```bash
# Migrations are auto-run on startup, or manually:
go run backend/cmd/server/main.go --migrate-only
```

### Client Installation

```bash
# NPM
npm install @efchat/efsec

# Yarn
yarn add @efchat/efsec

# PNPM
pnpm add @efchat/efsec
```

## API Documentation

### Authentication
All API endpoints (except `/health`) require JWT authentication via Bearer token in the Authorization header.

```http
Authorization: Bearer <jwt_token>
```

The JWT token must contain a `user_id` claim that will be used to identify the user.

### Endpoints

#### 1. Register Initial Keys
Registers a user's identity key, signed pre-key, and batch of one-time pre-keys.

**Endpoint:** `POST /api/e2e/keys`

**Request:**
```json
{
  "registration_id": 12345,
  "identity_public_key": [/* byte array */],
  "signed_pre_key": {
    "key_id": 1,
    "public_key": [/* byte array */],
    "signature": [/* byte array */]
  },
  "one_time_pre_keys": [
    {
      "key_id": 2,
      "public_key": [/* byte array */]
    },
    {
      "key_id": 3,
      "public_key": [/* byte array */]
    }
    // Typically 100 keys
  ]
}
```

**Response (201 Created):**
```json
{
  "status": "keys registered"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid request body or malformed keys
- `401 Unauthorized`: Missing or invalid JWT token
- `500 Internal Server Error`: Database error

#### 2. Get Pre-Key Bundle
Fetches a user's pre-key bundle for establishing a session.

**Endpoint:** `GET /api/e2e/bundle/{userId}`

**Parameters:**
- `userId` (path): Target user's ID

**Response (200 OK):**
```json
{
  "registration_id": 12345,
  "identity_public_key": [/* byte array */],
  "signed_pre_key": {
    "key_id": 1,
    "public_key": [/* byte array */],
    "signature": [/* byte array */]
  },
  "one_time_pre_key": {
    "key_id": 42,
    "public_key": [/* byte array */]
  }
}
```

**Notes:**
- `one_time_pre_key` may be null if no unused keys remain
- The returned one-time pre-key is marked as used

**Error Responses:**
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: User has not registered keys
- `500 Internal Server Error`: Database error

#### 3. Replenish One-Time Pre-Keys
Adds new one-time pre-keys when running low.

**Endpoint:** `POST /api/e2e/keys/replenish`

**Request:**
```json
[
  {
    "key_id": 101,
    "public_key": [/* byte array */]
  },
  {
    "key_id": 102,
    "public_key": [/* byte array */]
  }
  // Typically 100 new keys
]
```

**Response (201 Created):**
```json
{
  "added": 100
}
```

**Error Responses:**
- `400 Bad Request`: Invalid key format
- `401 Unauthorized`: Missing or invalid JWT token
- `500 Internal Server Error`: Database error

#### 4. Create Group
Creates a new encrypted group chat.

**Endpoint:** `POST /api/e2e/group/create`

**Request:**
```json
{
  "group_id": "optional-custom-id"
}
```

**Response (201 Created):**
```json
{
  "group_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Notes:**
- If `group_id` is omitted, a UUID is generated
- Creator is automatically added as first member

**Error Responses:**
- `401 Unauthorized`: Missing or invalid JWT token
- `409 Conflict`: Group ID already exists
- `500 Internal Server Error`: Database error

#### 5. Join Group
Join a group and share sender key.

**Endpoint:** `POST /api/e2e/group/{groupId}/join`

**Parameters:**
- `groupId` (path): Group identifier

**Request:**
```json
{
  "chain_key": [/* byte array */],
  "public_signature_key": [/* byte array */],
  "key_version": 1
}
```

**Response (200 OK):**
```json
{
  "status": "joined"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid sender key
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: Group does not exist
- `500 Internal Server Error`: Database error

#### 6. Get Group Keys
Fetch all member sender keys for a group.

**Endpoint:** `GET /api/e2e/group/{groupId}/keys`

**Parameters:**
- `groupId` (path): Group identifier

**Response (200 OK):**
```json
{
  "group_id": "550e8400-e29b-41d4-a716-446655440000",
  "members": [
    "user123",
    "user456",
    "user789"
  ],
  "sender_keys": [
    {
      "user_id": "user123",
      "chain_key": [/* byte array */],
      "public_signature_key": [/* byte array */],
      "key_version": 1
    },
    {
      "user_id": "user456",
      "chain_key": [/* byte array */],
      "public_signature_key": [/* byte array */],
      "key_version": 1
    }
  ],
  "key_version": 1
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: Group does not exist
- `500 Internal Server Error`: Database error

#### 7. Send Group Message
Relay an encrypted message to the group.

**Endpoint:** `POST /api/e2e/group/{groupId}/message`

**Parameters:**
- `groupId` (path): Group identifier

**Request:**
```json
{
  "ciphertext": [/* byte array */],
  "signature": [/* byte array */],
  "key_version": 1
}
```

**Response (201 Created):**
```json
{
  "message_id": "msg_123456789"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid message format
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User not member of group
- `404 Not Found`: Group does not exist
- `500 Internal Server Error`: Database error

#### 8. Health Check
Simple health check endpoint (no authentication required).

**Endpoint:** `GET /health`

**Response (200 OK):**
```text
OK
```

## Integration Guide

### Backend Integration

#### Complete Go Integration Example

```go
package main

import (
    "context"
    "database/sql"
    "log"
    "net/http"
    "strings"
    "time"
    
    "github.com/efchatnet/efsec/backend/integration"
    "github.com/golang-jwt/jwt/v5"
    "github.com/gorilla/mux"
    "github.com/redis/go-redis/v9"
    _ "github.com/lib/pq"
)

// JWT claims structure matching your main app
type Claims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
    jwt.RegisteredClaims
}

// Authentication middleware for E2E endpoints
func authMiddleware(jwtSecret []byte) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            authHeader := r.Header.Get("Authorization")
            if authHeader == "" {
                http.Error(w, "Unauthorized", http.StatusUnauthorized)
                return
            }

            parts := strings.Split(authHeader, " ")
            if len(parts) != 2 || parts[0] != "Bearer" {
                http.Error(w, "Invalid authorization header", http.StatusUnauthorized)
                return
            }

            tokenString := parts[1]
            claims := &Claims{}
            
            token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
                return jwtSecret, nil
            })

            if err != nil || !token.Valid {
                http.Error(w, "Invalid token", http.StatusUnauthorized)
                return
            }

            // Add user ID to context for E2E handlers
            ctx := context.WithValue(r.Context(), "user_id", claims.UserID)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}

func main() {
    // Database setup
    db, err := sql.Open("postgres", "postgres://user:pass@localhost/efchat?sslmode=require")
    if err != nil {
        log.Fatalf("Failed to connect to database: %v", err)
    }
    defer db.Close()

    // Redis setup with connection pooling
    rdb := redis.NewClient(&redis.Options{
        Addr:         "localhost:6379",
        DB:           1, // Separate DB for E2E
        PoolSize:     10,
        MinIdleConns: 3,
        MaxRetries:   3,
    })
    defer rdb.Close()

    // Test Redis connection
    ctx := context.Background()
    if err := rdb.Ping(ctx).Err(); err != nil {
        log.Fatalf("Failed to connect to Redis: %v", err)
    }

    // Initialize E2E integration
    e2e, err := integration.NewE2EIntegration(db, rdb)
    if err != nil {
        log.Fatalf("Failed to initialize E2E: %v", err)
    }

    // Setup router
    router := mux.NewRouter()
    
    // Your existing routes
    router.HandleFunc("/api/messages", yourMessageHandler).Methods("POST")
    router.HandleFunc("/api/users", yourUserHandler).Methods("GET")
    
    // Register E2E routes with authentication
    jwtSecret := []byte("your-jwt-secret")
    e2e.RegisterRoutes(router, authMiddleware(jwtSecret))
    
    // Middleware for CORS
    handler := corsMiddleware(router)
    
    // Start server
    server := &http.Server{
        Addr:         ":8080",
        Handler:      handler,
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 15 * time.Second,
    }
    
    log.Println("Server starting on :8080")
    if err := server.ListenAndServe(); err != nil {
        log.Fatalf("Server failed: %v", err)
    }
}

func corsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Access-Control-Allow-Origin", "https://app.efchat.net")
        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
        w.Header().Set("Access-Control-Allow-Credentials", "true")
        
        if r.Method == "OPTIONS" {
            w.WriteHeader(http.StatusNoContent)
            return
        }
        
        next.ServeHTTP(w, r)
    })
}

// Example: Check if user needs more one-time pre-keys
func checkPreKeyStatus(e2e *integration.E2EIntegration, userID string) {
    needsKeys, err := e2e.CheckPreKeyCount(userID, 20) // Alert if < 20 keys
    if err != nil {
        log.Printf("Failed to check pre-key count: %v", err)
        return
    }
    
    if needsKeys {
        // Notify client to generate and upload new keys
        notifyClientToReplenishKeys(userID)
    }
}
```

### Frontend Integration

#### Complete React Implementation

```tsx
// E2EContext.tsx - Context provider for E2E functionality
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { EfSecClient } from '@efchat/efsec';

interface E2EContextType {
  client: EfSecClient | null;
  isInitialized: boolean;
  error: Error | null;
  sendEncryptedMessage: (recipientId: string, message: string) => Promise<void>;
  decryptMessage: (senderId: string, encryptedData: Uint8Array) => Promise<string>;
  joinGroup: (groupId: string) => Promise<void>;
  sendGroupMessage: (groupId: string, message: string) => Promise<void>;
  decryptGroupMessage: (
    groupId: string,
    senderId: string,
    data: { ciphertext: Uint8Array; signature: Uint8Array; keyVersion: number }
  ) => Promise<string>;
}

const E2EContext = createContext<E2EContextType | null>(null);

export const useE2E = () => {
  const context = useContext(E2EContext);
  if (!context) {
    throw new Error('useE2E must be used within E2EProvider');
  }
  return context;
};

interface E2EProviderProps {
  children: React.ReactNode;
  apiUrl: string;
  authToken: string | null;
}

export const E2EProvider: React.FC<E2EProviderProps> = ({ children, apiUrl, authToken }) => {
  const [client, setClient] = useState<EfSecClient | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeE2E = async () => {
      if (!authToken) {
        setIsInitialized(false);
        setClient(null);
        return;
      }

      try {
        const e2eClient = new EfSecClient(apiUrl);
        await e2eClient.init(authToken);
        setClient(e2eClient);
        setIsInitialized(true);
        setError(null);
        
        // Check if we need to replenish keys
        checkAndReplenishKeys(e2eClient);
      } catch (err) {
        console.error('Failed to initialize E2E:', err);
        setError(err as Error);
        setIsInitialized(false);
      }
    };

    initializeE2E();
  }, [apiUrl, authToken]);

  const checkAndReplenishKeys = async (e2eClient: EfSecClient) => {
    try {
      const response = await fetch(`${apiUrl}/api/e2e/keys/status`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.remaining_keys < 20) {
          await e2eClient.replenishPreKeys(100);
        }
      }
    } catch (err) {
      console.warn('Failed to check key status:', err);
    }
  };

  const sendEncryptedMessage = useCallback(async (recipientId: string, message: string) => {
    if (!client) throw new Error('E2E not initialized');
    
    try {
      // Ensure session exists
      await client.startDMSession(recipientId);
      
      // Encrypt message
      const encrypted = await client.encryptDM(recipientId, message);
      
      // Send via your message API
      const response = await fetch(`${apiUrl}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          recipient_id: recipientId,
          encrypted_data: Array.from(encrypted),
          type: 'e2e_message'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
    } catch (err) {
      console.error('Failed to send encrypted message:', err);
      throw err;
    }
  }, [client, apiUrl, authToken]);

  const decryptMessage = useCallback(async (senderId: string, encryptedData: Uint8Array): Promise<string> => {
    if (!client) throw new Error('E2E not initialized');
    
    try {
      return await client.decryptDM(senderId, encryptedData);
    } catch (err) {
      console.error('Failed to decrypt message:', err);
      throw err;
    }
  }, [client]);

  const joinGroup = useCallback(async (groupId: string) => {
    if (!client) throw new Error('E2E not initialized');
    
    try {
      await client.joinGroup(groupId);
    } catch (err) {
      console.error('Failed to join group:', err);
      throw err;
    }
  }, [client]);

  const sendGroupMessage = useCallback(async (groupId: string, message: string) => {
    if (!client) throw new Error('E2E not initialized');
    
    try {
      const encrypted = await client.encryptGroupMessage(groupId, message);
      
      // Send via group message API
      const response = await fetch(`${apiUrl}/api/groups/${groupId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          ciphertext: Array.from(encrypted.ciphertext),
          signature: Array.from(encrypted.signature),
          key_version: encrypted.keyVersion
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send group message');
      }
    } catch (err) {
      console.error('Failed to send group message:', err);
      throw err;
    }
  }, [client, apiUrl, authToken]);

  const decryptGroupMessage = useCallback(async (
    groupId: string,
    senderId: string,
    data: { ciphertext: Uint8Array; signature: Uint8Array; keyVersion: number }
  ): Promise<string> => {
    if (!client) throw new Error('E2E not initialized');
    
    try {
      return await client.decryptGroupMessage(
        groupId,
        senderId,
        data.ciphertext,
        data.signature,
        data.keyVersion
      );
    } catch (err) {
      console.error('Failed to decrypt group message:', err);
      throw err;
    }
  }, [client]);

  const value: E2EContextType = {
    client,
    isInitialized,
    error,
    sendEncryptedMessage,
    decryptMessage,
    joinGroup,
    sendGroupMessage,
    decryptGroupMessage
  };

  return <E2EContext.Provider value={value}>{children}</E2EContext.Provider>;
};

// SecureChat.tsx - Complete chat component
import React, { useState, useEffect, useRef } from 'react';
import { useE2E } from './E2EContext';

interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  isEncrypted: boolean;
  decrypted?: string;
}

interface SecureChatProps {
  recipientId: string;
  recipientName: string;
  currentUserId: string;
}

export const SecureChat: React.FC<SecureChatProps> = ({ 
  recipientId, 
  recipientName,
  currentUserId 
}) => {
  const { isInitialized, sendEncryptedMessage, decryptMessage } = useE2E();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionEstablished, setSessionEstablished] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load message history
    loadMessages();
    
    // Setup WebSocket for real-time messages
    const ws = setupWebSocket();
    
    return () => {
      ws.close();
    };
  }, [recipientId]);

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/messages/${recipientId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const messagesWithDecryption = await Promise.all(
          data.messages.map(async (msg: any) => {
            if (msg.encrypted_data && msg.sender_id !== currentUserId) {
              try {
                const decrypted = await decryptMessage(
                  msg.sender_id,
                  new Uint8Array(msg.encrypted_data)
                );
                return { ...msg, decrypted };
              } catch {
                return { ...msg, decrypted: '[Failed to decrypt]' };
              }
            }
            return msg;
          })
        );
        setMessages(messagesWithDecryption);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const setupWebSocket = () => {
    const ws = new WebSocket(`wss://api.efchat.net/ws?token=${localStorage.getItem('token')}`);
    
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'e2e_message' && data.sender_id === recipientId) {
        try {
          const decrypted = await decryptMessage(
            data.sender_id,
            new Uint8Array(data.encrypted_data)
          );
          
          setMessages(prev => [...prev, {
            id: data.message_id,
            senderId: data.sender_id,
            content: decrypted,
            timestamp: new Date(data.timestamp),
            isEncrypted: true,
            decrypted
          }]);
        } catch (err) {
          console.error('Failed to decrypt incoming message:', err);
        }
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return ws;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !isInitialized || sending) {
      return;
    }

    setSending(true);
    
    try {
      await sendEncryptedMessage(recipientId, inputMessage);
      
      // Add message to local state
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        senderId: currentUserId,
        content: inputMessage,
        timestamp: new Date(),
        isEncrypted: true
      }]);
      
      setInputMessage('');
      setSessionEstablished(true);
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Initializing encryption...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <h2 className="text-xl font-semibold">{recipientName}</h2>
          <span className="ml-3 text-sm bg-green-500 px-2 py-1 rounded">
            🔒 End-to-End Encrypted
          </span>
        </div>
        {sessionEstablished && (
          <span className="text-sm">Session established</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p>No messages yet. Start a conversation!</p>
            <p className="text-sm mt-2">Messages are end-to-end encrypted.</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.senderId === currentUserId ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.senderId === currentUserId
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-900'
              }`}
            >
              <p className="break-words">
                {message.senderId === currentUserId 
                  ? message.content 
                  : (message.decrypted || message.content)}
              </p>
              <div className="flex items-center justify-between mt-1">
                <p className={`text-xs ${
                  message.senderId === currentUserId ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
                {message.isEncrypted && (
                  <span className="text-xs ml-2">🔒</span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4">
        <div className="flex space-x-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
            rows={1}
            disabled={sending}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || sending}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              !inputMessage.trim() || sending
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {sending ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Sending...
              </span>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// App.tsx - Main application component
import React from 'react';
import { E2EProvider } from './E2EContext';
import { SecureChat } from './SecureChat';

function App() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  
  useEffect(() => {
    // Load auth token from your authentication system
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    
    if (token && userId) {
      setAuthToken(token);
      setCurrentUserId(userId);
    }
  }, []);

  return (
    <E2EProvider apiUrl="https://api.efchat.net" authToken={authToken}>
      <div className="h-screen flex flex-col">
        <SecureChat 
          recipientId="user456" 
          recipientName="Alice Smith"
          currentUserId={currentUserId}
        />
      </div>
    </E2EProvider>
  );
}

export default App;
```

#### Vue.js Integration

```vue
<!-- E2EChat.vue -->
<template>
  <div class="e2e-chat">
    <div v-if="!isInitialized" class="loading">
      <div class="spinner"></div>
      <p>Initializing encryption...</p>
    </div>
    
    <div v-else class="chat-container">
      <div class="chat-header">
        <h2>{{ recipientName }}</h2>
        <span class="encrypted-badge">🔒 End-to-End Encrypted</span>
      </div>
      
      <div class="messages-container" ref="messagesContainer">
        <div v-if="messages.length === 0" class="no-messages">
          <p>No messages yet. Start a conversation!</p>
        </div>
        
        <div
          v-for="message in messages"
          :key="message.id"
          :class="['message', message.senderId === currentUserId ? 'sent' : 'received']"
        >
          <div class="message-content">
            {{ message.decrypted || message.content }}
          </div>
          <div class="message-meta">
            <span class="timestamp">{{ formatTime(message.timestamp) }}</span>
            <span v-if="message.isEncrypted" class="encrypted-icon">🔒</span>
          </div>
        </div>
      </div>
      
      <div class="message-input">
        <textarea
          v-model="inputMessage"
          @keydown.enter.prevent="sendMessage"
          placeholder="Type a message..."
          :disabled="sending"
        ></textarea>
        <button
          @click="sendMessage"
          :disabled="!inputMessage.trim() || sending"
          class="send-button"
        >
          {{ sending ? 'Sending...' : 'Send' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { EfSecClient } from '@efchat/efsec';

interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  isEncrypted: boolean;
  decrypted?: string;
}

// Props
const props = defineProps<{
  recipientId: string;
  recipientName: string;
  currentUserId: string;
  authToken: string;
  apiUrl: string;
}>();

// State
const client = ref<EfSecClient | null>(null);
const isInitialized = ref(false);
const messages = ref<Message[]>([]);
const inputMessage = ref('');
const sending = ref(false);
const messagesContainer = ref<HTMLDivElement>();
let ws: WebSocket | null = null;

// Initialize E2E client
onMounted(async () => {
  try {
    const e2eClient = new EfSecClient(props.apiUrl);
    await e2eClient.init(props.authToken);
    client.value = e2eClient;
    isInitialized.value = true;
    
    // Load messages
    await loadMessages();
    
    // Setup WebSocket
    setupWebSocket();
  } catch (error) {
    console.error('Failed to initialize E2E:', error);
  }
});

// Cleanup
onUnmounted(() => {
  if (ws) {
    ws.close();
  }
});

// Load message history
async function loadMessages() {
  try {
    const response = await fetch(`${props.apiUrl}/api/messages/${props.recipientId}`, {
      headers: {
        'Authorization': `Bearer ${props.authToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Decrypt messages
      for (const msg of data.messages) {
        if (msg.encrypted_data && msg.sender_id !== props.currentUserId) {
          try {
            msg.decrypted = await client.value!.decryptDM(
              msg.sender_id,
              new Uint8Array(msg.encrypted_data)
            );
          } catch {
            msg.decrypted = '[Failed to decrypt]';
          }
        }
      }
      
      messages.value = data.messages;
      await scrollToBottom();
    }
  } catch (error) {
    console.error('Failed to load messages:', error);
  }
}

// Setup WebSocket for real-time messages
function setupWebSocket() {
  ws = new WebSocket(`wss://api.efchat.net/ws?token=${props.authToken}`);
  
  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'e2e_message' && data.sender_id === props.recipientId) {
      try {
        const decrypted = await client.value!.decryptDM(
          data.sender_id,
          new Uint8Array(data.encrypted_data)
        );
        
        messages.value.push({
          id: data.message_id,
          senderId: data.sender_id,
          content: decrypted,
          timestamp: new Date(data.timestamp),
          isEncrypted: true,
          decrypted
        });
        
        await scrollToBottom();
      } catch (error) {
        console.error('Failed to decrypt message:', error);
      }
    }
  };
}

// Send encrypted message
async function sendMessage() {
  if (!inputMessage.value.trim() || !client.value || sending.value) {
    return;
  }
  
  sending.value = true;
  
  try {
    // Ensure session exists
    await client.value.startDMSession(props.recipientId);
    
    // Encrypt and send
    const encrypted = await client.value.encryptDM(props.recipientId, inputMessage.value);
    
    const response = await fetch(`${props.apiUrl}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${props.authToken}`
      },
      body: JSON.stringify({
        recipient_id: props.recipientId,
        encrypted_data: Array.from(encrypted),
        type: 'e2e_message'
      })
    });
    
    if (response.ok) {
      messages.value.push({
        id: Date.now().toString(),
        senderId: props.currentUserId,
        content: inputMessage.value,
        timestamp: new Date(),
        isEncrypted: true
      });
      
      inputMessage.value = '';
      await scrollToBottom();
    }
  } catch (error) {
    console.error('Failed to send message:', error);
    alert('Failed to send message');
  } finally {
    sending.value = false;
  }
}

// Utilities
function formatTime(timestamp: Date): string {
  return new Date(timestamp).toLocaleTimeString();
}

async function scrollToBottom() {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}
</script>

<style scoped>
.e2e-chat {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: #3498db;
  color: white;
}

.encrypted-badge {
  background: #27ae60;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.no-messages {
  text-align: center;
  color: #999;
  margin-top: 2rem;
}

.message {
  display: flex;
  margin-bottom: 1rem;
}

.message.sent {
  justify-content: flex-end;
}

.message.received {
  justify-content: flex-start;
}

.message-content {
  max-width: 70%;
  padding: 0.75rem;
  border-radius: 8px;
  word-wrap: break-word;
}

.message.sent .message-content {
  background: #3498db;
  color: white;
}

.message.received .message-content {
  background: #ecf0f1;
  color: #2c3e50;
}

.message-meta {
  display: flex;
  align-items: center;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #7f8c8d;
}

.message-input {
  display: flex;
  padding: 1rem;
  border-top: 1px solid #ecf0f1;
}

.message-input textarea {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: none;
  font-family: inherit;
}

.send-button {
  margin-left: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.send-button:hover:not(:disabled) {
  background: #2980b9;
}

.send-button:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}
</style>
```

## Database Schema

### Tables Structure

```sql
-- 1. Identity Keys (user's main encryption identity)
CREATE TABLE identity_keys (
    user_id VARCHAR(255) PRIMARY KEY,
    public_key BYTEA NOT NULL,              -- Ed25519 public key
    registration_id INTEGER NOT NULL,        -- Unique device ID (1-16383)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 2. Signed Pre-Keys (medium-term keys, rotated weekly)
CREATE TABLE signed_pre_keys (
    user_id VARCHAR(255) NOT NULL,
    key_id INTEGER NOT NULL,                -- Incremental ID
    public_key BYTEA NOT NULL,              -- Curve25519 public key
    signature BYTEA NOT NULL,               -- Ed25519 signature
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,                   -- Optional expiration
    PRIMARY KEY (user_id, key_id),
    FOREIGN KEY (user_id) REFERENCES identity_keys(user_id) ON DELETE CASCADE
);

-- 3. One-Time Pre-Keys (consumed after single use)
CREATE TABLE one_time_pre_keys (
    user_id VARCHAR(255) NOT NULL,
    key_id INTEGER NOT NULL,                -- Unique per user
    public_key BYTEA NOT NULL,              -- Curve25519 public key
    used BOOLEAN NOT NULL DEFAULT FALSE,    -- Marked true when consumed
    used_at TIMESTAMP,                      -- When it was used
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, key_id),
    FOREIGN KEY (user_id) REFERENCES identity_keys(user_id) ON DELETE CASCADE
);

-- 4. Groups
CREATE TABLE groups (
    group_id VARCHAR(255) PRIMARY KEY,      -- UUID or custom ID
    created_by VARCHAR(255) NOT NULL,       -- Creator user ID
    name VARCHAR(255),                      -- Optional group name
    description TEXT,                       -- Optional description
    max_members INTEGER DEFAULT 256,        -- Member limit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES identity_keys(user_id)
);

-- 5. Group Members
CREATE TABLE group_members (
    group_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',      -- admin, moderator, member
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    invited_by VARCHAR(255),
    sender_key_version INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES identity_keys(user_id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES identity_keys(user_id)
);

-- 6. Sender Keys (for group encryption)
CREATE TABLE sender_keys (
    group_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    chain_key BYTEA NOT NULL,               -- AES-256 chain key
    public_signature_key BYTEA NOT NULL,    -- Ed25519 public key
    key_version INTEGER NOT NULL DEFAULT 1, -- Incremented on rotation
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rotated_at TIMESTAMP,                   -- Last rotation time
    PRIMARY KEY (group_id, user_id, key_version),
    FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES identity_keys(user_id) ON DELETE CASCADE
);

-- 7. Encrypted Group Messages (optional storage)
CREATE TABLE encrypted_group_messages (
    message_id VARCHAR(255) PRIMARY KEY,    -- UUID
    group_id VARCHAR(255) NOT NULL,
    sender_id VARCHAR(255) NOT NULL,
    ciphertext BYTEA NOT NULL,              -- AES-GCM encrypted
    signature BYTEA NOT NULL,               -- Ed25519 signature
    key_version INTEGER NOT NULL,           -- Sender key version used
    sequence_number BIGINT,                 -- Message ordering
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES identity_keys(user_id)
);

-- 8. Encrypted DM Messages (optional storage)
CREATE TABLE encrypted_dm_messages (
    message_id VARCHAR(255) PRIMARY KEY,    -- UUID
    sender_id VARCHAR(255) NOT NULL,
    recipient_id VARCHAR(255) NOT NULL,
    ciphertext BYTEA NOT NULL,              -- Signal message format
    message_type INTEGER NOT NULL,          -- 0=PreKey, 1=Regular
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES identity_keys(user_id),
    FOREIGN KEY (recipient_id) REFERENCES identity_keys(user_id)
);

-- 9. Sessions (track active E2E sessions)
CREATE TABLE sessions (
    user_id VARCHAR(255) NOT NULL,
    peer_id VARCHAR(255) NOT NULL,
    session_data BYTEA,                     -- Serialized session state
    established_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    message_count BIGINT DEFAULT 0,
    PRIMARY KEY (user_id, peer_id),
    FOREIGN KEY (user_id) REFERENCES identity_keys(user_id) ON DELETE CASCADE,
    FOREIGN KEY (peer_id) REFERENCES identity_keys(user_id)
);

-- 10. Key Rotation Log (audit trail)
CREATE TABLE key_rotation_log (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    key_type VARCHAR(50) NOT NULL,          -- identity, signed_pre_key, sender_key
    old_key_id INTEGER,
    new_key_id INTEGER,
    reason VARCHAR(255),                    -- scheduled, compromised, user_initiated
    rotated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES identity_keys(user_id)
);

-- Performance Indexes
CREATE INDEX idx_unused_prekeys ON one_time_pre_keys(user_id, used) WHERE used = FALSE;
CREATE INDEX idx_group_messages ON encrypted_group_messages(group_id, created_at DESC);
CREATE INDEX idx_dm_messages ON encrypted_dm_messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX idx_session_activity ON sessions(last_used_at DESC);
CREATE INDEX idx_sender_keys_active ON sender_keys(group_id, key_version DESC);
```

## Security Considerations

### JWT Token Implementation

```go
// JWT token structure your auth middleware should validate
type Claims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
    Roles  []string `json:"roles"`
    jwt.RegisteredClaims
}

// Validation requirements:
// 1. RS256 or HS256 signature algorithm
// 2. Expiration time validation
// 3. Issuer validation
// 4. user_id claim must be present
```

### Key Rotation Schedule

| Key Type | Rotation Period | Trigger |
|----------|----------------|---------|
| Identity Keys | Never (account lifetime) | Only on compromise |
| Signed Pre-Keys | 7-30 days | Time-based |
| One-Time Pre-Keys | After each use | Consumption |
| Sender Keys | 30 days or member change | Time or membership |

### Rate Limiting Recommendations

```nginx
# Nginx rate limiting configuration
limit_req_zone $binary_remote_addr zone=e2e_keys:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=e2e_messages:10m rate=100r/m;

location /api/e2e/keys {
    limit_req zone=e2e_keys burst=5 nodelay;
    proxy_pass http://backend;
}

location /api/e2e/group {
    limit_req zone=e2e_messages burst=20 nodelay;
    proxy_pass http://backend;
}
```

### CORS Configuration

```go
// Production CORS settings
func corsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        origin := r.Header.Get("Origin")
        
        // Whitelist allowed origins
        allowedOrigins := []string{
            "https://app.efchat.net",
            "https://efchat.net",
            "https://staging.efchat.net"
        }
        
        for _, allowed := range allowedOrigins {
            if origin == allowed {
                w.Header().Set("Access-Control-Allow-Origin", origin)
                break
            }
        }
        
        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
        w.Header().Set("Access-Control-Max-Age", "86400")
        w.Header().Set("Access-Control-Allow-Credentials", "true")
        
        if r.Method == "OPTIONS" {
            w.WriteHeader(http.StatusNoContent)
            return
        }
        
        next.ServeHTTP(w, r)
    })
}
```

## Docker Deployment

### Dockerfile

```dockerfile
# Multi-stage build for minimal image size
FROM golang:1.21-alpine AS backend-builder

RUN apk add --no-cache git make

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY backend/ ./backend/
COPY Makefile ./
RUN make build-backend

# Frontend builder
FROM node:18-alpine AS frontend-builder

WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
RUN cd client && npm run build

# Final stage
FROM alpine:3.18

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=backend-builder /app/bin/efsec-server /app/
COPY --from=frontend-builder /app/client/dist /app/client/dist

EXPOSE 8081

CMD ["/app/efsec-server"]
```

### docker-compose.yml

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
    networks:
      - efsec-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U efsec"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - efsec-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  efsec:
    build: .
    ports:
      - "8081:8081"
    environment:
      DATABASE_URL: postgres://efsec:${DB_PASSWORD}@postgres:5432/efsec?sslmode=disable
      REDIS_URL: redis:6379
      PORT: 8081
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - efsec-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  efsec-network:
    driver: bridge
```

## Troubleshooting

### Common Issues and Solutions

#### 1. "Failed to initialize E2E" Error

**Symptoms:** Client fails to initialize, console shows initialization errors

**Solutions:**
```javascript
// Check IndexedDB availability
if (!window.indexedDB) {
  console.error('IndexedDB not available');
  // Fall back to in-memory storage
}

// Verify auth token is valid
const decoded = jwt_decode(authToken);
if (decoded.exp < Date.now() / 1000) {
  // Token expired, refresh it
  await refreshAuthToken();
}

// Clear corrupt storage
async function resetE2E() {
  await indexedDB.deleteDatabase('efchat-e2e');
  window.location.reload();
}
```

#### 2. "No unused prekeys remaining" Error

**Symptoms:** GET /bundle/{userId} returns error about prekeys

**Solutions:**
```bash
# Check prekey count
psql -d efsec -c "SELECT user_id, COUNT(*) as unused_keys 
FROM one_time_pre_keys 
WHERE used = FALSE 
GROUP BY user_id;"

# Manually trigger replenishment
curl -X POST https://api.efchat.net/api/e2e/keys/replenish \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"key_id": 1001, "public_key": [...]}, ...]'
```

#### 3. Database Migration Failures

**Symptoms:** Server fails to start with migration errors

**Solutions:**
```sql
-- Check current schema version
SELECT * FROM schema_migrations;

-- Manually run missing migrations
BEGIN;
-- Run migration SQL here
INSERT INTO schema_migrations (version) VALUES ('002_add_indexes');
COMMIT;

-- Reset all migrations (CAUTION: Data loss)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

#### 4. Session Establishment Issues

**Debug logging:**
```javascript
// Enable verbose logging
localStorage.setItem('e2e_debug', 'true');

class EfSecClient {
  async startDMSession(userId) {
    if (this.debug) console.log('Starting session with', userId);
    
    try {
      const bundle = await this.fetchPreKeyBundle(userId);
      if (this.debug) console.log('Bundle received:', bundle);
      
      await this.processBundle(bundle);
      if (this.debug) console.log('Session established');
    } catch (err) {
      if (this.debug) console.error('Session failed:', err);
      throw err;
    }
  }
}
```

#### 5. Performance Issues

**Database query optimization:**
```sql
-- Analyze query performance
EXPLAIN ANALYZE 
SELECT * FROM one_time_pre_keys 
WHERE user_id = 'user123' AND used = FALSE 
LIMIT 1;

-- Update statistics
ANALYZE one_time_pre_keys;

-- Vacuum table
VACUUM ANALYZE one_time_pre_keys;
```

**Redis connection pooling:**
```go
rdb := redis.NewClient(&redis.Options{
    Addr:         "localhost:6379",
    PoolSize:     50,        // Increase for high load
    MinIdleConns: 10,        // Keep connections ready
    MaxRetries:   3,
    PoolTimeout:  4 * time.Second,
})
```

### Debug Endpoints (Development Only)

```go
// Add these endpoints for development debugging
if os.Getenv("ENV") == "development" {
    // Key statistics
    router.HandleFunc("/debug/keys/stats", func(w http.ResponseWriter, r *http.Request) {
        stats := getKeyStatistics()
        json.NewEncoder(w).Encode(stats)
    }).Methods("GET")
    
    // Session info
    router.HandleFunc("/debug/sessions", func(w http.ResponseWriter, r *http.Request) {
        sessions := getActiveSessions()
        json.NewEncoder(w).Encode(sessions)
    }).Methods("GET")
}
```

## Performance Tuning

### PostgreSQL Configuration

```ini
# postgresql.conf optimizations for E2E workload
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
huge_pages = try
```

### Redis Configuration

```conf
# redis.conf optimizations
maxmemory 512mb
maxmemory-policy allkeys-lru
save ""  # Disable persistence for cache-only use
tcp-keepalive 60
timeout 300
```

### Connection Pool Settings

```go
// Optimal connection pool for production
db.SetMaxOpenConns(25)
db.SetMaxIdleConns(10)
db.SetConnMaxLifetime(5 * time.Minute)
db.SetConnMaxIdleTime(10 * time.Minute)
```

## Monitoring

### Key Metrics to Track

```go
// Prometheus metrics
var (
    keysGenerated = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "e2e_keys_generated_total",
            Help: "Total number of keys generated",
        },
        []string{"type"},
    )
    
    sessionEstablished = prometheus.NewCounter(
        prometheus.CounterOpts{
            Name: "e2e_sessions_established_total",
            Help: "Total number of sessions established",
        },
    )
    
    preKeysRemaining = prometheus.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "e2e_prekeys_remaining",
            Help: "Number of unused prekeys per user",
        },
        []string{"user_id"},
    )
)
```

### Health Check Implementation

```go
type HealthStatus struct {
    Status   string `json:"status"`
    Database string `json:"database"`
    Redis    string `json:"redis"`
    PreKeys  int    `json:"total_unused_prekeys"`
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
    status := HealthStatus{Status: "healthy"}
    
    // Check database
    if err := db.Ping(); err != nil {
        status.Database = "unhealthy"
        status.Status = "degraded"
    } else {
        status.Database = "healthy"
    }
    
    // Check Redis
    if err := rdb.Ping(context.Background()).Err(); err != nil {
        status.Redis = "unhealthy"
        status.Status = "degraded"
    } else {
        status.Redis = "healthy"
    }
    
    // Count total unused prekeys
    var count int
    db.QueryRow("SELECT COUNT(*) FROM one_time_pre_keys WHERE used = FALSE").Scan(&count)
    status.PreKeys = count
    
    if count < 1000 {
        status.Status = "warning"
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(status)
}
```

## License

This project is licensed under the GNU General Public License v3.0 or later - see the LICENSE file for details.

## Support

For issues and questions:
- GitHub Issues: https://github.com/efchatnet/efsec/issues
- Security Issues: security@efchat.net (PGP key available)
- Documentation: https://docs.efchat.net/e2e