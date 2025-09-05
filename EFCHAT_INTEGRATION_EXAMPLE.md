# efchat Integration Example

This shows exactly how efchat should use the efsec module for E2E encryption.

## Frontend Integration (SolidJS/React)

```typescript
// In your main App component or authentication handler
import { createE2EIntegration, E2EWebSocketInterceptor, E2ELockIcon, DMInitiator } from '@efchatnet/efsec';

// 1. Create E2E integration (safe - won't break if module fails)
const e2e = createE2EIntegration({
  apiUrl: '/api/e2e',
  getAuthToken: () => localStorage.getItem('jwt_token'),
  onE2EStatusChange: (enabled) => {
    console.log('E2E status:', enabled ? 'Available' : 'Unavailable');
  },
  debug: true
});

// 2. Initialize when user logs in (non-blocking)
async function handleUserLogin(userId: string, token: string) {
  // Store token for E2E to use
  localStorage.setItem('jwt_token', token);
  
  // Try to initialize E2E (won't break if it fails)
  const e2eReady = await e2e.initializeE2E(userId);
  if (!e2eReady) {
    console.log('E2E not available, continuing without encryption');
  }
}

// 3. In your chat component
function ChatComponent({ spaceId, recipientId, isGroup }) {
  const [isE2EEnabled, setIsE2EEnabled] = useState(false);

  // Check E2E status
  useEffect(() => {
    setIsE2EEnabled(e2e.isE2EReady());
  }, []);

  // Send encrypted message
  const sendMessage = async (text: string) => {
    const envelope = await e2e.encryptMessage(recipientId, text, isGroup);
    
    // Send via websocket
    websocket.send({
      type: 'message',
      spaceId: spaceId,
      content: envelope.content,
      encrypted: envelope.encrypted,
      encryptionData: envelope.encryptionData
    });
  };

  // Receive encrypted message
  const handleIncomingMessage = async (msg: any) => {
    if (msg.encrypted && e2e.isE2EReady()) {
      const decrypted = await e2e.decryptMessage(msg.senderId, msg, msg.isGroup);
      displayMessage(decrypted);
    } else {
      displayMessage(msg.content);
    }
  };

  return (
    <div>
      {/* Show encryption status */}
      <E2ELockIcon 
        state={isE2EEnabled ? 'encrypted' : 'unencrypted'} 
        showLabel={true}
      />
      
      {/* Rest of chat UI */}
    </div>
  );
}

// 4. In user profile or contact list
function UserProfile({ userId, userName }) {
  const handleDMCreated = (space) => {
    // Navigate to the DM space
    navigate(`/chat/${space.spaceId}`);
  };

  return (
    <div>
      <h2>{userName}</h2>
      
      {/* Button to start encrypted DM */}
      <DMInitiator
        peerId={userId}
        peerName={userName}
        dmService={e2e.dmService}
        onDMCreated={handleDMCreated}
        buttonText="Start Encrypted Chat"
      />
    </div>
  );
}

// 5. WebSocket integration
const wsInterceptor = new E2EWebSocketInterceptor(e2e);

// Wrap your websocket handlers
ws.onmessage = async (event) => {
  let data = JSON.parse(event.data);
  
  // Process incoming encrypted messages
  if (data.type === 'message' && data.encrypted) {
    data = await wsInterceptor.processIncoming(data, data.senderId);
  }
  
  handleMessage(data);
};

// Before sending
const sendViaWebSocket = async (message) => {
  const processed = await wsInterceptor.processOutgoing(
    message,
    currentChatRecipient
  );
  ws.send(JSON.stringify(processed));
};
```

## Backend Integration (Go)

Already implemented in `/home/grim/Code/efchat/cmd/server/main.go`:

```go
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
    // Register routes - E2E works seamlessly
    e2e.RegisterRoutes(router, authMiddleware)
    log.Printf("E2E encryption module initialized successfully")
}
```

## Key Features

### 1. Graceful Degradation
- If efsec module fails to load, efchat continues normally
- Messages sent unencrypted if E2E initialization fails
- No hard dependencies - everything is optional

### 2. Visual Indicators
- 🔒 Green lock = Encrypted
- 🔓 Red lock = Not encrypted
- 🔐 Yellow lock = Initializing

### 3. Automatic DM Creation
- Click "Start Encrypted Chat" on any user
- Creates private 2-person space
- Establishes E2E automatically

### 4. Private Spaces
- E2E enabled by default for private spaces
- Only logged-in users can use E2E
- Automatic key exchange

### 5. Seamless Integration
- No manual key management
- Transparent encryption/decryption
- Works with existing websocket

## Testing E2E Integration

1. **Check if E2E is available:**
```javascript
if (e2e.isE2EReady()) {
  console.log('E2E is ready');
}
```

2. **Get E2E status:**
```javascript
const status = e2e.getStatus();
console.log('E2E available:', status.available);
console.log('E2E initialized:', status.initialized);
```

3. **Test DM creation:**
```javascript
const spaceId = await e2e.initiateDM('other-user-id');
if (spaceId) {
  console.log('DM created:', spaceId);
} else {
  console.log('DM creation failed, use regular chat');
}
```

## Failure Scenarios

### If efsec npm module not installed:
- efchat works normally
- No E2E features shown
- Regular unencrypted messaging

### If backend E2E routes not available:
- Frontend detects during initialization
- Falls back to unencrypted
- Shows appropriate UI (red lock)

### If user not logged in:
- E2E features hidden
- Shows "Login required for encrypted messages"
- Regular guest messaging works

### If Signal session fails:
- Message sent unencrypted
- Warning logged to console
- User can still chat normally

## Summary

The integration is designed to be:
- **Non-breaking**: efchat works without efsec
- **Transparent**: Encryption happens automatically
- **Visual**: Clear indicators of encryption status
- **Simple**: No manual key management
- **Robust**: Handles all failure cases gracefully