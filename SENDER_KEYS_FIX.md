# Critical Security Fix: Sender Keys Protocol

## Current Security Issues (MUST FIX)

1. **Chain keys stored on server** - CRITICAL vulnerability
2. **Chain keys sent in plaintext** to server - violates zero-knowledge
3. **No pairwise encryption** for key distribution

## Correct Sender Keys Implementation

### How It Should Work

1. **Group Creation**
   - Creator generates their sender key (chain key + signature key pair)
   - Server only tracks group membership

2. **Member Joins Group**
   - New member generates their sender key locally
   - Establishes Signal sessions with all existing members
   - Sends sender key via encrypted DM to each member
   - Receives other members' sender keys via encrypted DMs

3. **Key Distribution Flow**
```
Alice joins group with Bob and Charlie:
1. Alice generates sender key
2. Alice establishes Signal session with Bob (using X3DH)
3. Alice sends her sender key to Bob via encrypted DM
4. Bob sends his sender key to Alice via encrypted DM
5. Alice establishes Signal session with Charlie
6. Alice sends her sender key to Charlie via encrypted DM
7. Charlie sends his sender key to Alice via encrypted DM
```

4. **Message Sending**
   - Encrypt with YOUR chain key
   - Sign with YOUR signature key
   - Send single ciphertext to server
   - Server does fanout to all members

5. **Message Receiving**
   - Use sender's chain key (received via encrypted DM)
   - Verify with sender's public signature key
   - Decrypt message

## Required Changes

### Backend
- ✅ Remove chain_key from database schema
- ✅ Remove chain_key from models
- Server should ONLY store:
  - Group membership
  - Public signature keys (for identity)
  - Encrypted message blobs

### Client
- Fix joinGroup to NOT send chain_key to server
- Implement pairwise key distribution:
  ```typescript
  async distributeGroupKeys(groupId: string) {
    const members = await this.getGroupMembers(groupId);
    const mySenderKey = await this.generateSenderKey();
    
    for (const member of members) {
      // Establish Signal session if needed
      if (!await this.hasSession(member)) {
        await this.establishSession(member);
      }
      
      // Send my sender key via encrypted DM
      const encrypted = await this.encryptDM(member, mySenderKey);
      await this.sendKeyDistributionMessage(member, encrypted);
    }
  }
  ```

### Security Properties After Fix
- ✅ Zero-knowledge server (no access to keys)
- ✅ End-to-end encryption for key distribution
- ✅ Forward secrecy for key exchange (via Signal DMs)
- ✅ Authentication via signatures
- ✅ No key exposure on server compromise

## Implementation Priority
1. Fix backend to remove chain_key storage ✅
2. Fix client to stop sending chain_key to server ✅
3. Implement pairwise key distribution
4. Add key rotation on member removal
5. Test complete flow