// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

use vodozemac::megolm::{
    GroupSession, InboundGroupSession, MegolmMessage, SessionConfig as MegolmSessionConfig,
    SessionKey,
};
use vodozemac::olm::{Account, OlmMessage, PreKeyMessage, Session, SessionConfig};
use vodozemac::Curve25519PublicKey;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
}

/// WebAssembly wrapper for `vodozemac` `Account`
#[wasm_bindgen]
pub struct EfSecAccount {
    inner: Account,
}

impl Default for EfSecAccount {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl EfSecAccount {
    /// Create a new E2E account
    #[must_use]
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: Account::new(),
        }
    }

    /// Get account identity keys as JSON
    #[must_use]
    #[wasm_bindgen(getter)]
    pub fn identity_keys(&self) -> String {
        let keys = self.inner.identity_keys();
        serde_json::to_string(&keys).unwrap_or_default()
    }

    /// Generate one-time keys
    #[wasm_bindgen]
    pub fn generate_one_time_keys(&mut self, count: usize) {
        self.inner.generate_one_time_keys(count);
    }

    /// Get one-time keys as JSON
    #[must_use]
    #[wasm_bindgen]
    pub fn one_time_keys(&self) -> String {
        serde_json::to_string(&self.inner.one_time_keys()).unwrap_or_default()
    }

    /// Create outbound session with another user
    ///
    /// # Errors
    ///
    /// Returns `JsValue` error if key parsing fails
    #[wasm_bindgen]
    pub fn create_outbound_session(
        &self,
        identity_key: &str,
        one_time_key: &str,
    ) -> Result<EfSecSession, JsValue> {
        let identity_key = Curve25519PublicKey::from_base64(identity_key)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let one_time_key = Curve25519PublicKey::from_base64(one_time_key)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let config = SessionConfig::version_2();
        let session = self
            .inner
            .create_outbound_session(config, identity_key, one_time_key);
        Ok(EfSecSession { inner: session })
    }

    /// Create inbound session from pre-key message
    ///
    /// # Errors
    ///
    /// Returns `JsValue` error if message parsing or session creation fails
    #[wasm_bindgen]
    pub fn create_inbound_session(
        &mut self,
        message: &str,
        identity_key: &str,
    ) -> Result<EfSecInboundResult, JsValue> {
        let decoded = base64_decode(message)?;
        let identity_key = Curve25519PublicKey::from_base64(identity_key)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let pre_key_message =
            PreKeyMessage::from_bytes(&decoded).map_err(|e| JsValue::from_str(&e.to_string()))?;

        let result = self
            .inner
            .create_inbound_session(identity_key, &pre_key_message)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(EfSecInboundResult {
            session: EfSecSession {
                inner: result.session,
            },
            plaintext: String::from_utf8(result.plaintext)
                .map_err(|e| JsValue::from_str(&e.to_string()))?,
        })
    }
}

/// Result type for inbound session creation
#[wasm_bindgen]
pub struct EfSecInboundResult {
    #[allow(dead_code)]
    session: EfSecSession,
    plaintext: String,
}

#[wasm_bindgen]
impl EfSecInboundResult {
    #[must_use]
    #[wasm_bindgen(getter)]
    pub fn plaintext(&self) -> String {
        self.plaintext.clone()
    }
}

/// WebAssembly wrapper for vodozemac Session (1:1 messaging)
#[wasm_bindgen]
pub struct EfSecSession {
    inner: Session,
}

#[wasm_bindgen]
impl EfSecSession {
    /// Encrypt a message
    #[must_use]
    #[wasm_bindgen]
    pub fn encrypt(&mut self, plaintext: &str) -> String {
        let message = self.inner.encrypt(plaintext.as_bytes());
        let (_type, bytes) = message.to_parts();
        base64_encode(&bytes)
    }

    /// Decrypt a message
    ///
    /// # Errors
    ///
    /// Returns `JsValue` error if decryption or string conversion fails
    #[wasm_bindgen]
    pub fn decrypt(&mut self, ciphertext: &str) -> Result<String, JsValue> {
        let decoded = base64_decode(ciphertext)?;
        // For WASM, we'll assume it's a normal message for now
        let message =
            OlmMessage::from_parts(1, &decoded).map_err(|e| JsValue::from_str(&e.to_string()))?;

        let plaintext = self
            .inner
            .decrypt(&message)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        String::from_utf8(plaintext).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Get session ID
    #[must_use]
    #[wasm_bindgen]
    pub fn session_id(&self) -> String {
        self.inner.session_id()
    }
}

/// WebAssembly wrapper for `vodozemac` `GroupSession` (group messaging)
#[wasm_bindgen]
pub struct EfSecOutboundGroupSession {
    inner: GroupSession,
}

impl Default for EfSecOutboundGroupSession {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl EfSecOutboundGroupSession {
    /// Create new outbound group session
    #[must_use]
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: GroupSession::new(MegolmSessionConfig::version_1()),
        }
    }

    /// Encrypt group message
    #[must_use]
    #[wasm_bindgen]
    pub fn encrypt(&mut self, plaintext: &str) -> String {
        let message = self.inner.encrypt(plaintext.as_bytes());
        base64_encode(&message.to_bytes())
    }

    /// Get session key for sharing with group members
    #[must_use]
    #[wasm_bindgen]
    pub fn session_key(&self) -> String {
        base64_encode(&self.inner.session_key().to_bytes())
    }

    /// Get session ID
    #[must_use]
    #[wasm_bindgen]
    pub fn session_id(&self) -> String {
        self.inner.session_id()
    }
}

/// WebAssembly wrapper for `vodozemac` `InboundGroupSession`
#[wasm_bindgen]
pub struct EfSecInboundGroupSession {
    inner: InboundGroupSession,
}

#[wasm_bindgen]
impl EfSecInboundGroupSession {
    /// Create inbound group session from session key
    ///
    /// # Errors
    ///
    /// Returns `JsValue` error if session key parsing fails
    #[wasm_bindgen(constructor)]
    pub fn new(session_key: &str) -> Result<Self, JsValue> {
        let decoded = base64_decode(session_key)?;
        let key =
            SessionKey::from_bytes(&decoded).map_err(|e| JsValue::from_str(&e.to_string()))?;

        let session = InboundGroupSession::new(&key, MegolmSessionConfig::version_1());
        Ok(Self { inner: session })
    }

    /// Decrypt group message
    ///
    /// # Errors
    ///
    /// Returns `JsValue` error if decryption or string conversion fails
    #[wasm_bindgen]
    pub fn decrypt(&mut self, ciphertext: &str) -> Result<String, JsValue> {
        let decoded = base64_decode(ciphertext)?;
        let message =
            MegolmMessage::from_bytes(&decoded).map_err(|e| JsValue::from_str(&e.to_string()))?;

        let result = self
            .inner
            .decrypt(&message)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        String::from_utf8(result.plaintext).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Get session ID
    #[must_use]
    #[wasm_bindgen]
    pub fn session_id(&self) -> String {
        self.inner.session_id()
    }
}

// Helper functions for base64 encoding/decoding
#[allow(clippy::cast_possible_truncation)]
fn base64_encode(data: &[u8]) -> String {
    use js_sys::Uint8Array;
    use web_sys::window;

    let uint8_array = Uint8Array::new_with_length(data.len() as u32);
    uint8_array.copy_from(data);

    let window = window().unwrap();
    window
        .btoa(&String::from_utf16_lossy(
            &uint8_array
                .to_vec()
                .iter()
                .map(|&b| u16::from(b))
                .collect::<Vec<_>>(),
        ))
        .unwrap()
}

fn base64_decode(data: &str) -> Result<Vec<u8>, JsValue> {
    use web_sys::window;

    let window = window().unwrap();
    let decoded = window
        .atob(data)
        .map_err(|_e| JsValue::from_str("Invalid base64"))?;

    Ok(decoded.chars().map(|c| c as u8).collect())
}
