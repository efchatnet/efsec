# Security Policy

## Overview

efsec implements end-to-end encryption for efchat using the Signal Protocol. This document outlines the security model, threat analysis, and audit requirements for the implementation.

## Security Principles

### 1. Zero-Knowledge Architecture
- **Backend Never Sees Private Keys**: All private keys are generated and stored exclusively on the client side in IndexedDB
- **No Plaintext on Server**: The backend only stores public keys and encrypted messages
- **Forward Secrecy**: Each message uses ephemeral keys through the Double Ratchet algorithm
- **Post-Compromise Security**: Compromise of long-term keys doesn't affect past messages

### 2. Cryptographic Primitives

#### Signal Protocol Implementation
- **X3DH Key Agreement**: Extended Triple Diffie-Hellman for initial key exchange
- **Double Ratchet**: Provides forward secrecy and break-in recovery
- **Sender Keys**: Efficient group messaging with forward secrecy
- **Curve25519**: For all Diffie-Hellman operations
- **Ed25519**: For signatures
- **AES-256**: For symmetric encryption
- **HMAC-SHA256**: For message authentication

#### Key Types
| Key Type | Purpose | Rotation | Storage |
|----------|---------|----------|---------|
| Identity Key | Long-term identity | Never (account lifetime) | IndexedDB + Backend (public only) |
| Signed Pre-Key | Medium-term key exchange | 7-30 days | IndexedDB + Backend (public only) |
| One-Time Pre-Key | Single-use key exchange | After each use | IndexedDB + Backend (public only) |
| Session Keys | Message encryption | Every message (ratchet) | IndexedDB only |
| Sender Keys | Group encryption | 30 days or member change | IndexedDB only |

### 3. Trust Model

#### Trust On First Use (TOFU)
- Identity keys are trusted on first contact
- Future messages verify against stored identity
- Key changes trigger security warnings

#### Authentication
- JWT tokens authenticate API requests
- User ID extracted from verified JWT claims
- No bearer tokens stored on server

## Threat Model

### In Scope Threats

1. **Network Attackers**
   - Passive eavesdropping
   - Active MITM attacks
   - Traffic analysis (partial mitigation)

2. **Server Compromise**
   - Database breach
   - Redis cache compromise
   - Log file exposure

3. **Client Compromise (Limited)**
   - XSS attacks (mitigated by CSP)
   - Local storage attacks (use IndexedDB)

### Out of Scope Threats

1. **Endpoint Compromise**
   - Malware on user device
   - Physical device access
   - OS-level keyloggers

2. **Metadata Protection**
   - Who talks to whom
   - Message timing
   - Message frequency

3. **Implementation Bugs in vodozemac**
   - We trust Matrix.org's implementation
   - Regular updates from upstream

## Security Controls

### Backend Security

#### Input Validation
```go
// All user inputs are validated
if len(publicKey) != 32 {
    return errors.New("invalid public key length")
}
```

#### Rate Limiting
- Key registration: 10 requests per minute
- Message sending: 100 requests per minute
- Pre-key fetching: 20 requests per minute

#### Security Headers
```go
w.Header().Set("X-Content-Type-Options", "nosniff")
w.Header().Set("X-Frame-Options", "DENY")
w.Header().Set("Content-Security-Policy", "default-src 'self'")
w.Header().Set("Strict-Transport-Security", "max-age=31536000")
```

### Frontend Security

#### Key Storage
- Private keys ONLY in IndexedDB (not localStorage)
- Keys encrypted at rest with user passphrase (future)
- Automatic key zeroization on logout

#### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self'; 
               connect-src 'self' https://api.efchat.net;
               img-src 'self' data:;
               style-src 'self' 'unsafe-inline';">
```

#### XSS Prevention
- All user content sanitized before display
- React's automatic escaping
- No `dangerouslySetInnerHTML` usage

## Audit Requirements

### Code Audit Checklist

#### Cryptographic Operations
- [ ] All crypto operations use vodozemac (no custom crypto)
- [ ] Proper random number generation
- [ ] Constant-time comparisons for secrets
- [ ] No key material in logs
- [ ] Proper key zeroization

#### Backend Security
- [ ] JWT validation on all protected endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] Rate limiting implemented
- [ ] CORS properly configured
- [ ] Security headers present

#### Frontend Security
- [ ] XSS prevention measures
- [ ] CSRF protection
- [ ] Secure key storage (IndexedDB only)
- [ ] No secrets in source code
- [ ] Proper CSP headers

### Dependency Verification

#### vodozemac Verification
```bash
# Verify vodozemac is from official Matrix source
cd vodozemac
git remote -v | grep "github.com/matrix-org/vodozemac.git"

# Check specific version
git rev-parse HEAD
```

#### NPM Package Verification
```bash
# Check package integrity
npm audit

# Verify package signatures
npm install --verify-signatures
```

## Vulnerability Disclosure

### Reporting Security Issues

**DO NOT** report security vulnerabilities through GitHub issues.

Email: security@efchat.net
PGP Key: [Available on keyserver]

Include:
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

### Response Timeline
- **24 hours**: Initial response
- **72 hours**: Vulnerability confirmation
- **7 days**: Fix development
- **30 days**: Public disclosure (coordinated)

## Security Testing

### Unit Tests
```typescript
describe('Signal Protocol', () => {
  it('should establish session with valid prekey bundle', async () => {
    // Test X3DH key exchange
  });
  
  it('should reject invalid signatures', async () => {
    // Test signature verification
  });
});
```

### Integration Tests
```go
func TestE2EEncryption(t *testing.T) {
    // Test full encryption flow
}

func TestKeyRotation(t *testing.T) {
    // Test key rotation scenarios
}
```

### Penetration Testing
Recommended tools:
- OWASP ZAP for web security
- Burp Suite for API testing
- SQLMap for injection testing

## Compliance

### GDPR Compliance
- Right to deletion (key removal)
- Data portability (key export)
- Encryption at rest and in transit

### Security Standards
- Signal Protocol specification compliance
- OWASP Top 10 mitigation
- CWE/SANS Top 25 addressed

## Incident Response

### Key Compromise
1. Immediate key rotation
2. Notify affected users
3. Audit access logs
4. Update security measures

### Data Breach
1. Isolate affected systems
2. Preserve evidence
3. Notify users within 72 hours
4. Report to authorities as required

## Security Roadmap

### Implemented
- [x] Signal Protocol integration
- [x] JWT authentication
- [x] Basic rate limiting
- [x] Security headers

### Planned
- [ ] Hardware security module (HSM) support
- [ ] Key escrow for enterprise
- [ ] Passphrase-based key encryption
- [ ] Certificate pinning
- [ ] Tor support

## References

- [Signal Protocol Specification](https://signal.org/docs/)
- [OWASP Security Guidelines](https://owasp.org/)
- [vodozemac Documentation](https://github.com/matrix-org/vodozemac)
- [Double Ratchet Algorithm](https://signal.org/docs/specifications/doubleratchet/)
- [X3DH Key Agreement](https://signal.org/docs/specifications/x3dh/)

---

Last Updated: 2024
Security Contact: security@efchat.net