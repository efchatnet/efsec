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
	"net/http"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/efchatnet/efsec/backend/models"
	"github.com/efchatnet/efsec/backend/storage"
)

type GroupHandler struct {
	store storage.GroupStore
}

func NewGroupHandler(store storage.GroupStore) *GroupHandler {
	return &GroupHandler{store: store}
}

func (h *GroupHandler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	
	var req struct {
		GroupID string `json:"group_id,omitempty"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	
	if req.GroupID == "" {
		req.GroupID = uuid.New().String()
	}
	
	if err := h.store.CreateGroup(req.GroupID, userID); err != nil {
		http.Error(w, "Failed to create group", http.StatusInternalServerError)
		return
	}
	
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"group_id": req.GroupID})
}

func (h *GroupHandler) JoinGroup(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	vars := mux.Vars(r)
	groupID := vars["groupId"]
	
	var senderKey models.SenderKey
	if err := json.NewDecoder(r.Body).Decode(&senderKey); err != nil {
		http.Error(w, "Invalid sender key", http.StatusBadRequest)
		return
	}
	
	senderKey.GroupID = groupID
	senderKey.UserID = userID
	
	if err := h.store.AddGroupMember(groupID, userID); err != nil {
		http.Error(w, "Failed to join group", http.StatusInternalServerError)
		return
	}
	
	if err := h.store.SaveSenderKey(senderKey); err != nil {
		http.Error(w, "Failed to save sender key", http.StatusInternalServerError)
		return
	}
	
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "joined"})
}

func (h *GroupHandler) GetGroupMembers(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["groupId"]
	
	members, err := h.store.GetGroupMembers(groupID)
	if err != nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"group_id": groupID,
		"members": members,
	})
}

func (h *GroupHandler) SendGroupMessage(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	vars := mux.Vars(r)
	groupID := vars["groupId"]
	
	var msg models.EncryptedGroupMessage
	if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
		http.Error(w, "Invalid message", http.StatusBadRequest)
		return
	}
	
	msg.MessageID = uuid.New().String()
	msg.GroupID = groupID
	msg.SenderID = userID
	
	if err := h.store.SaveGroupMessage(msg); err != nil {
		http.Error(w, "Failed to save message", http.StatusInternalServerError)
		return
	}
	
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message_id": msg.MessageID})
}

func (h *GroupHandler) LeaveGroup(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	vars := mux.Vars(r)
	groupID := vars["groupId"]
	
	if err := h.store.RemoveGroupMember(groupID, userID); err != nil {
		http.Error(w, "Failed to leave group", http.StatusInternalServerError)
		return
	}
	
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "left"})
}