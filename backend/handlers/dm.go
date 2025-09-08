// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package handlers

import (
	"encoding/json"
	"net/http"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/efchatnet/efsec/backend/models"
	"github.com/efchatnet/efsec/backend/storage"
)

type DMHandler struct {
	store storage.DMStore
}

func NewDMHandler(store storage.DMStore) *DMHandler {
	return &DMHandler{store: store}
}

// SendDM handles sending encrypted direct messages (including key distribution)
func (h *DMHandler) SendDM(w http.ResponseWriter, r *http.Request) {
	senderID := r.Context().Value("user_id").(string)
	
	var req struct {
		RecipientID  string `json:"recipient_id"`
		Ciphertext   []byte `json:"ciphertext"`
		MessageType  string `json:"message_type"` // "message" or "key_distribution"
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	// Create DM record
	dm := models.EncryptedDM{
		MessageID:    uuid.New().String(),
		SenderID:     senderID,
		RecipientID:  req.RecipientID,
		Ciphertext:   req.Ciphertext,
		MessageType:  req.MessageType,
	}
	
	if err := h.store.SaveDM(dm); err != nil {
		http.Error(w, "Failed to save DM", http.StatusInternalServerError)
		return
	}
	
	// TODO: Send real-time notification via WebSocket if recipient is online
	
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"message_id": dm.MessageID,
		"status": "sent",
	})
}

// GetDMs retrieves encrypted DMs for the authenticated user
func (h *DMHandler) GetDMs(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	
	// Get query parameters for pagination
	messageType := r.URL.Query().Get("type") // filter by message type
	limit := 50 // default limit
	
	dms, err := h.store.GetDMsForUser(userID, messageType, limit)
	if err != nil {
		http.Error(w, "Failed to retrieve DMs", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"messages": dms,
		"count": len(dms),
	})
}

// GetDMsWith retrieves DMs between authenticated user and specific user
func (h *DMHandler) GetDMsWith(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	vars := mux.Vars(r)
	otherUserID := vars["userId"]
	
	limit := 100 // default limit
	
	dms, err := h.store.GetDMsBetweenUsers(userID, otherUserID, limit)
	if err != nil {
		http.Error(w, "Failed to retrieve DMs", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"messages": dms,
		"count": len(dms),
	})
}

// MarkDMRead marks a DM as read
func (h *DMHandler) MarkDMRead(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	vars := mux.Vars(r)
	messageID := vars["messageId"]
	
	if err := h.store.MarkDMAsRead(messageID, userID); err != nil {
		http.Error(w, "Failed to mark message as read", http.StatusInternalServerError)
		return
	}
	
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "marked_read",
	})
}

// DeleteDM removes a DM (only for recipient)
func (h *DMHandler) DeleteDM(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	vars := mux.Vars(r)
	messageID := vars["messageId"]
	
	if err := h.store.DeleteDMForUser(messageID, userID); err != nil {
		http.Error(w, "Failed to delete message", http.StatusInternalServerError)
		return
	}
	
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "deleted",
	})
}