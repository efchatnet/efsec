# efchat Integration Guide

This guide explains how to integrate the efsec E2E encryption module into efchat.

## Architecture Overview

The efsec module provides complete E2E encryption functionality that efchat imports as a dependency. All E2E logic, components, and utilities live in efsec and are consumed by efchat.

```
efsec (this repository)
├── backend/          # Go backend module
│   └── integration/  # Plugin interface for efchat backend
├── client/          # TypeScript/React frontend module  
│   ├── components/  # React components
│   ├── hooks/       # React hooks
│   └── protocol/    # Signal Protocol implementation
└── package.json     # npm package configuration
```

## Backend Integration

### 1. Add Go Module Dependency

In your efchat `go.mod`:

```go
require github.com/efchatnet/efsec v0.1.0
```

### 2. Import and Initialize

In `efchat/cmd/server/main.go`:

```go
import (
    "github.com/efchatnet/efsec/backend/integration"
    "github.com/gorilla/mux"
    "github.com/redis/go-redis/v9"
)

func main() {
    // ... existing efchat setup ...
    
    // Initialize E2E encryption integration
    e2eConfig := &integration.Config{
        DB:        dbAdapter.Postgres.DB,
        Redis:     dbAdapter.Redis.Client.(*redis.Client),
        JWTSecret: cfg.JWT.Secret,
        JWTIssuer: cfg.JWT.Issuer,
    }
    
    e2e, err := integration.NewE2EIntegration(e2eConfig)
    if err != nil {
        log.Printf("Warning: E2E encryption module initialization failed: %v", err)
        log.Printf("E2E encryption will be disabled for this session")
    } else {
        // Create a gorilla/mux subrouter for E2E endpoints
        e2eMux := mux.NewRouter().PathPrefix("/api/e2e").Subrouter()
        
        // Register E2E routes with custom auth middleware wrapper
        authWrapper := func(next http.Handler) http.Handler {
            return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                // Extract JWT from efchat's context and add to Authorization header
                if token := r.Context().Value("jwt_token"); token != nil {
                    r.Header.Set("Authorization", "Bearer " + token.(string))
                }
                next.ServeHTTP(w, r)
            })
        }
        e2e.RegisterRoutes(e2eMux, authWrapper)
        
        // Mount the E2E routes on the main chi router
        router.Mount("/api/e2e", e2eMux)
        log.Printf("E2E encryption module initialized successfully")
    }
}
```

### 3. Database Migrations

The E2E module will automatically run its own migrations when initialized. These create the necessary tables:
- `signal_keys` - Stores public keys
- `signal_prekeys` - Stores one-time prekeys
- `signal_sessions` - Stores session data
- `signal_groups` - Stores group information
- `signal_sender_keys` - Stores group sender keys

## Frontend Integration

### 1. Add npm Dependency

In your efchat `package.json`:

```json
{
  "dependencies": {
    "@efchatnet/efsec": "github:efchatnet/efsec#main"
  }
}
```

Then install:
```bash
npm install --legacy-peer-deps
```

### 2. Using E2E Components

Import components and hooks directly from efsec:

```typescript
// In your chat component
import { 
  E2EStatusIndicator, 
  useE2EMessaging 
} from '@efchatnet/efsec';

function ChatComponent() {
  const { 
    encrypt, 
    decrypt, 
    initialize, 
    isReady,
    isInitialized,
    isInitializing 
  } = useE2EMessaging();
  
  // Initialize on login
  useEffect(() => {
    if (user && authToken) {
      initialize(user.id, authToken);
    }
  }, [user, authToken]);
  
  // Show encryption status
  return (
    <div>
      <E2EStatusIndicator 
        isEncrypted={isInitialized}
        isInitializing={isInitializing}
        conversationId={currentChat.id}
      />
      {/* Rest of your chat UI */}
    </div>
  );
}
```

### 3. Encrypting/Decrypting Messages

```typescript
// Before sending a message
const sendMessage = async (text: string) => {
  let messageToSend = text;
  
  if (isReady()) {
    // Encrypt for DM or group
    messageToSend = await encrypt(
      recipientId, 
      text, 
      isGroupChat
    );
  }
  
  // Send via websocket
  websocket.send({
    type: 'message',
    content: messageToSend,
    encrypted: isReady()
  });
};

// When receiving a message
const handleMessage = async (message: any) => {
  let content = message.content;
  
  if (message.encrypted && isReady()) {
    content = await decrypt(
      message.senderId,
      message.content,
      message.isGroup
    );
  }
  
  // Display the decrypted message
  displayMessage(content);
};
```

## WebSocket Integration

For real-time encrypted messaging:

```typescript
// In your websocket handler
import { useE2EMessaging } from '@efchatnet/efsec';

const ws = new WebSocket('wss://efchat.net/ws');
const { encrypt, decrypt, isReady } = useE2EMessaging();

ws.onmessage = async (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'message' && data.encrypted) {
    // Decrypt the message
    data.content = await decrypt(
      data.senderId, 
      data.content,
      data.isGroup
    );
  }
  
  // Process the message
  processMessage(data);
};
```

## Environment Variables

The E2E module uses the same environment variables as efchat:

```bash
# Backend
JWT_SECRET=your-jwt-secret
JWT_ISSUER=efchat
DATABASE_URL=postgres://...
REDIS_URL=localhost:6379

# Frontend (if needed)
REACT_APP_API_URL=https://api.efchat.net
```

## API Endpoints

All E2E endpoints are mounted under `/api/e2e`:

- `POST /api/e2e/keys` - Register user keys
- `GET /api/e2e/bundle/{userId}` - Get prekey bundle
- `POST /api/e2e/keys/replenish` - Add more one-time keys
- `POST /api/e2e/group/create` - Create encrypted group
- `POST /api/e2e/group/{groupId}/join` - Join group
- `GET /api/e2e/group/{groupId}/keys` - Get group keys
- `POST /api/e2e/group/{groupId}/message` - Send group message
- `POST /api/e2e/group/{groupId}/leave` - Leave group
- `POST /api/e2e/group/{groupId}/rekey` - Rotate group keys

## Security Considerations

1. **Authentication**: The module uses efchat's existing JWT authentication
2. **Key Storage**: Private keys are stored only in IndexedDB on the client
3. **Forward Secrecy**: Each message uses ephemeral keys
4. **Group Keys**: Rotated when members leave

## Troubleshooting

### Module Not Found

If you get "module not found" errors:

```bash
# Backend
go mod tidy

# Frontend  
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Database Migration Failed

Check that the PostgreSQL user has CREATE TABLE permissions:

```sql
GRANT CREATE ON SCHEMA public TO your_user;
```

### E2E Not Initializing

1. Check browser console for IndexedDB errors
2. Verify JWT token is being passed correctly
3. Check network tab for failed API calls

## Development Workflow

1. All E2E changes are made in the efsec repository
2. efchat automatically pulls the latest version on build
3. To test local changes, use Go/npm replace directives:

```go
// go.mod
replace github.com/efchatnet/efsec => ../efsec
```

```json
// package.json
"@efchatnet/efsec": "file:../efsec"
```

## Support

For E2E encryption issues, file bugs at: https://github.com/efchatnet/efsec/issues