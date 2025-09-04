# efsec
efchat secure message protocol

## Tasks
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
