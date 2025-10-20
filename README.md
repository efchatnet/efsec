# efsec — Matrix Protocol End-to-End Encryption (in progress)

[![npm version](https://badge.fury.io/js/efsec.svg)](https://badge.fury.io/js/efsec)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%20v3+-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![status: experimental](https://img.shields.io/badge/status-experimental-orange)](./SECURITY.md)

**efsec** is an in-progress, experimental end-to-end encryption library providing a high-level TypeScript interface to the [Matrix](https://matrix.org) E2E encryption standards. It builds on top of [`@matrix-org/matrix-sdk-crypto-wasm`](https://github.com/matrix-org/matrix-rust-sdk/tree/main/crates/matrix-sdk-crypto) (Matrix’s audited cryptographic implementation), offering both convenience wrappers and direct access to the underlying cryptographic primitives.

> ⚠️ **Development status:** efsec is **not yet production-ready**. It’s an exploratory reference implementation under active development. Security audits are ongoing; do not use efsec in applications that handle sensitive data in production environments.

---

## ✨ Features

- ✅ **Matrix-compliant** — follows Matrix E2E encryption specifications
- ✅ **Dual API** — simple wrappers *and* direct Matrix SDK access
- ✅ **Zero-knowledge architecture** — private keys never leave the client device
- ✅ **Olm & Megolm** — secure one-to-one and group messaging
- ✅ **X3DH** key exchange — modern authenticated key agreement
- ✅ **Double Ratchet** — forward + backward secrecy for all messages
- ✅ **Secure storage** — IndexedDB key persistence
- ✅ **TypeScript-first** — strong types and structured error handling
- ✅ **Audited core** — backed by Matrix’s formally reviewed crypto libraries

---

## 🚀 Installation

```bash
npm install efsec
```

---

## 🧩 Quick Start

### High-Level API (recommended for most projects)

```typescript
import {
  initializeWasm,
  generateIdentityKeyPair,
  generateOneTimePreKeys,
  createOutboundSession,
  encryptMessage,
  decryptMessage,
  KeyStore
} from "efsec";

await initializeWasm();

// Generate identity keys
const identityKeys = await generateIdentityKeyPair();
console.log("Curve25519:", identityKeys.curve25519.key);
console.log("Ed25519:", identityKeys.ed25519.key);

// Generate pre-keys for X3DH
const oneTimeKeys = await generateOneTimePreKeys(50);

// Secure local key storage
const keyStore = new KeyStore();
await keyStore.initialize();
await keyStore.storeIdentityKeys("device-1", identityKeys);

// Encrypt / decrypt
const session = await createOutboundSession(identityKeys, recipientBundle);
const message = { content: "Hello!", timestamp: Date.now(), id: "msg-1" };
const encrypted = await encryptMessage(session, message);
const decrypted = await decryptMessage(session, encrypted);
```

### Direct Matrix SDK Access (advanced)

```typescript
import * as MatrixCrypto from "@matrix-org/matrix-sdk-crypto-wasm";

await MatrixCrypto.initAsync();

const olmMachine = await MatrixCrypto.OlmMachine.initialize(
  new MatrixCrypto.UserId("@user:domain.com"),
  new MatrixCrypto.DeviceId("DEVICE123")
);

const keys = olmMachine.identityKeys;
console.log(keys.curve25519.toBase64(), keys.ed25519.toBase64());
```

---

## 🔐 Key Storage

efsec offers secure IndexedDB-based key persistence:

```typescript
import { KeyStore } from "efsec";

const keyStore = new KeyStore();
await keyStore.initialize();

const deviceId = "device-1";
const identityKeys = await generateIdentityKeyPair();

await keyStore.storeIdentityKeys(deviceId, identityKeys);

const storedKeys = await keyStore.getIdentityKeys(deviceId);

// Export / import for backups
const backup = await keyStore.exportData(deviceId);
await keyStore.importData(backup);
```

---

## 📘 API Reference

### Core

| Function | Description |
| --- | --- |
| `initializeWasm()` | Initialize the Matrix crypto WASM module. |
| `generateIdentityKeyPair()` | Create Matrix-compliant Curve25519 + Ed25519 keys. |
| `generateOneTimePreKeys(count?)` | Generate pre-keys for X3DH sessions. |

### Sessions

| Function | Description |
| --- | --- |
| `createOutboundSession()` | Create an outbound X3DH session. |
| `encryptMessage()` | Encrypt a plaintext message using Double Ratchet / Megolm. |
| `decryptMessage()` | Decrypt messages while maintaining forward secrecy. |

### Group (Megolm)

| Function | Description |
| --- | --- |
| `createOutboundGroupSession()` | Start a new group encryption session. |
| `createInboundGroupSessionFromKey()` | Import a shared group session key. |

### Storage

`KeyStore` — secure IndexedDB store for device identity + session state.

---

## 🧱 Architecture

efsec uses a dual-layer design:

1. High-level API — ergonomic wrappers for common tasks.
2. Direct SDK access — full Matrix control via `@matrix-org/matrix-sdk-crypto-wasm`.

This approach lets developers:

- Prototype quickly using simple wrappers.
- Transition smoothly to full Matrix primitives.
- Stay 100% protocol-compatible throughout.

---

## ⚡ Example Integration

```typescript
import { initializeWasm, generateIdentityKeyPair, KeyStore } from "efsec";
import * as MatrixCrypto from "@matrix-org/matrix-sdk-crypto-wasm";

await initializeWasm();

const identityKeys = await generateIdentityKeyPair();
const store = new KeyStore();
await store.storeIdentityKeys("device-1", identityKeys);

const olmMachine = await MatrixCrypto.OlmMachine.initialize(
  new MatrixCrypto.UserId("@user:example.com"),
  new MatrixCrypto.DeviceId("DEVICE123")
);

const requests = await olmMachine.outgoingRequests();
for (const req of requests) {
  if (req.type === MatrixCrypto.RequestType.KeysUpload) {
    const res = await fetch("/matrix/keys/upload", {
      method: "POST",
      body: req.body
    });
    await olmMachine.markRequestAsSent(req.id, req.type, await res.text());
  }
}
```

---

## 🧯 Error Handling

efsec defines clear error classes for predictable behavior:

```typescript
import { DecryptionError, SessionError, KeyError } from "efsec";

try {
  const plaintext = await decryptMessage(session, encrypted);
} catch (err) {
  if (err instanceof DecryptionError) console.error("Decryption failed", err);
  if (err instanceof SessionError) console.error("Session error", err);
  if (err instanceof KeyError) console.error("Key error", err);
}
```

Common scenarios:

- `DecryptionError` — wrong session or corrupted ciphertext
- `SessionError` — invalid session state
- `KeyError` — missing or malformed key data

---

## 🌍 Browser Support

Requirements:

- IndexedDB
- Web Crypto API
- WebAssembly
- ES2022 modules

| Browser | Min Version |
| --- | --- |
| Chrome | 88+ |
| Firefox | 90+ |
| Safari | 14+ |
| Edge | 88+ |

---

## 🛡️ Security & Auditing

efsec’s cryptography builds on formally audited Matrix libraries:

- Matrix SDK Crypto: `@matrix-org/matrix-sdk-crypto-wasm`
- Vodozemac: audited by Least Authority
- Matrix E2E Spec: peer-reviewed and publicly maintained

All private-key operations occur client-side. Server components have zero knowledge of plaintext or key material.

Security researchers are welcome to review efsec’s wrapper layer — see `SECURITY.md` for guidelines.

---

## 🛡️ Responsible Disclosure

Found a potential vulnerability? Please review our [SECURITY.md](./SECURITY.md) for private reporting instructions.

---

## 📜 License

GPL v3 or later — see `LICENSE`.

efsec is free software: you can redistribute or modify it under the terms of the GNU General Public License v3 or (at your option) any later version.

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Add tests
4. Run `npm test` (coming soon)
5. Submit a pull request

For major changes, open an issue first to discuss direction.

---

## 🕒 Changelog

See `CHANGELOG.md` for version history.

---

## 🔗 Links

- Repository: https://github.com/efchatnet/efsec
- Issues: https://github.com/efchatnet/efsec/issues
- Security policy: [SECURITY.md](./SECURITY.md)
- License: [GPL-3.0-or-later](./LICENSE)

---

Disclaimer: efsec is experimental software under active development. Do not deploy it in production or rely on it for protecting confidential data without an independent security audit.
