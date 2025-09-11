// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"github.com/gorilla/mux"
	"github.com/efchatnet/efsec/backend/models"
	"github.com/efchatnet/efsec/backend/storage"
)

type KeyHandler struct {
	store storage.KeyStore
}

func NewKeyHandler(store storage.KeyStore) *KeyHandler {
	return &KeyHandler{store: store}
}

func (h *KeyHandler) RegisterKeys(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	
	var registration models.KeyRegistration
	if err := json.NewDecoder(r.Body).Decode(&registration); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Debug logging to see what we actually received
	fmt.Printf("[KeyHandler] RegisterKeys for user: %s\n", userID)
	fmt.Printf("[KeyHandler] Registration ID: %d\n", registration.RegistrationID)
	fmt.Printf("[KeyHandler] Identity key length: %d bytes\n", len(registration.IdentityPublicKey))
	fmt.Printf("[KeyHandler] Signed pre-key ID: %d\n", registration.SignedPreKey.KeyID)
	fmt.Printf("[KeyHandler] One-time pre-keys count: %d\n", len(registration.OneTimePreKeys))

	if err := h.store.SaveIdentityKey(userID, registration); err != nil {
		fmt.Printf("[KeyHandler] Error saving keys for user %s: %v\n", userID, err)
		http.Error(w, "Failed to save keys", http.StatusInternalServerError)
		return
	}

	fmt.Printf("[KeyHandler] Successfully saved keys for user: %s\n", userID)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "keys registered"})
}

func (h *KeyHandler) GetPreKeyBundle(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["user_id"]

	bundle, err := h.store.GetPreKeyBundle(userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(bundle)
}

func (h *KeyHandler) ReplenishPreKeys(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	
	var prekeys []models.OneTimePreKey
	if err := json.NewDecoder(r.Body).Decode(&prekeys); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.store.AddOneTimePreKeys(userID, prekeys); err != nil {
		http.Error(w, "Failed to add prekeys", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]int{"added": len(prekeys)})
}