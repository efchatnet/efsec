// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Disable the default test harness for WASM target to avoid main symbol conflicts
#![cfg_attr(target_arch = "wasm32", no_main)]

use vodozemac::megolm::{
    GroupSession, InboundGroupSession, MegolmMessage, SessionConfig as MegolmSessionConfig,
    SessionKey,
};
use vodozemac::olm::{Account, OlmMessage, PreKeyMessage, Session, SessionConfig};
use vodozemac::Curve25519PublicKey;
use wasm_bindgen::prelude::*;

/// Initialize the WASM module with panic hook for better debugging
#[cfg(target_arch = "wasm32")]
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
    #[wasm_bindgen(constructor)]
    #[must_use]
    pub fn new() -> Self {
        Self {
            inner: Account::new(),
        }
    }

    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn identity_keys(&self) -> String {
        serde_json::to_string(&self.inner.identity_keys()).unwrap_or_default()
    }

    #[must_use]
    pub fn one_time_keys(&self) -> String {
        serde_json::to_string(&self.inner.one_time_keys()).unwrap_or_default()
    }

    pub fn generate_one_time_keys(&mut self, count: usize) {
        self.inner.generate_one_time_keys(count);
    }

    /// Create an outbound session with the given identity and one-time keys.
    ///
    /// # Errors
    /// Returns error if JSON deserialization of keys fails.
    pub fn create_outbound_session(
        &self,
        identity_key: &str,
        one_time_key: &str,
    ) -> Result<EfSecSession, JsValue> {
        let identity_key: Curve25519PublicKey =
            serde_json::from_str(identity_key).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let one_time_key: Curve25519PublicKey =
            serde_json::from_str(one_time_key).map_err(|e| JsValue::from_str(&e.to_string()))?;

        let session = self.inner.create_outbound_session(
            SessionConfig::version_1(),
            identity_key,
            one_time_key,
        );

        Ok(EfSecSession { inner: session })
    }

    /// Create an inbound session from an identity key and prekey message.
    ///
    /// # Errors
    /// Returns error if JSON deserialization fails or session creation fails.
    pub fn create_inbound_session(
        &mut self,
        identity_key: &str,
        message: &str,
    ) -> Result<EfSecSession, JsValue> {
        let identity_key: Curve25519PublicKey =
            serde_json::from_str(identity_key).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let message: PreKeyMessage =
            serde_json::from_str(message).map_err(|e| JsValue::from_str(&e.to_string()))?;

        let result = self
            .inner
            .create_inbound_session(identity_key, &message)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(EfSecSession {
            inner: result.session,
        })
    }
}

/// WebAssembly wrapper for `vodozemac` `Session`
#[wasm_bindgen]
pub struct EfSecSession {
    inner: Session,
}

#[wasm_bindgen]
impl EfSecSession {
    #[must_use]
    pub fn session_id(&self) -> String {
        self.inner.session_id()
    }

    pub fn encrypt(&mut self, plaintext: &str) -> String {
        let message = self.inner.encrypt(plaintext);
        serde_json::to_string(&message).unwrap_or_default()
    }

    /// Decrypt a message using this session.
    ///
    /// # Errors
    /// Returns error if JSON deserialization fails, decryption fails, or UTF-8 conversion fails.
    pub fn decrypt(&mut self, message: &str) -> Result<String, JsValue> {
        let message: OlmMessage =
            serde_json::from_str(message).map_err(|e| JsValue::from_str(&e.to_string()))?;

        let plaintext_bytes = self
            .inner
            .decrypt(&message)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        String::from_utf8(plaintext_bytes).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

/// WebAssembly wrapper for `vodozemac` `GroupSession` (outbound)
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
    #[wasm_bindgen(constructor)]
    #[must_use]
    pub fn new() -> Self {
        Self {
            inner: GroupSession::new(MegolmSessionConfig::version_1()),
        }
    }

    #[must_use]
    pub fn session_key(&self) -> String {
        self.inner.session_key().to_base64()
    }

    #[must_use]
    pub fn session_id(&self) -> String {
        self.inner.session_id()
    }

    pub fn encrypt(&mut self, plaintext: &str) -> String {
        let message = self.inner.encrypt(plaintext);
        message.to_base64()
    }
}

/// WebAssembly wrapper for `vodozemac` `InboundGroupSession`
#[wasm_bindgen]
pub struct EfSecInboundGroupSession {
    inner: InboundGroupSession,
}

#[wasm_bindgen]
impl EfSecInboundGroupSession {
    /// Create a new inbound group session from a session key.
    ///
    /// # Errors
    /// Returns error if session key decoding from base64 fails.
    #[wasm_bindgen(constructor)]
    pub fn new(session_key: &str) -> Result<Self, JsValue> {
        let session_key =
            SessionKey::from_base64(session_key).map_err(|e| JsValue::from_str(&e.to_string()))?;

        let session = InboundGroupSession::new(&session_key, MegolmSessionConfig::version_1());

        Ok(Self { inner: session })
    }

    /// Decrypt a group message using this inbound session.
    ///
    /// # Errors
    /// Returns error if base64 decoding fails, decryption fails, or UTF-8 conversion fails.
    pub fn decrypt(&mut self, message: &str) -> Result<String, JsValue> {
        let message =
            MegolmMessage::from_base64(message).map_err(|e| JsValue::from_str(&e.to_string()))?;

        let decrypted = self
            .inner
            .decrypt(&message)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        String::from_utf8(decrypted.plaintext).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}
