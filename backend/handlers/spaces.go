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
	"strings"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/efchatnet/efsec/backend/middleware"
	"github.com/efchatnet/efsec/backend/storage"
)

// SpaceHandler handles E2E space management
type SpaceHandler struct {
	store storage.Store
}

// NewSpaceHandler creates a new space handler
func NewSpaceHandler(store storage.Store) *SpaceHandler {
	return &SpaceHandler{store: store}
}

// InitiateDMRequest represents a request to create a DM space
type InitiateDMRequest struct {
	PeerID   string `json:"peer_id"`
	EnableE2E bool   `json:"enable_e2e"`
}

// InitiateDM creates or retrieves an encrypted DM space between two users
// POST /api/e2e/dm/initiate
func (h *SpaceHandler) InitiateDM(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req InitiateDMRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.PeerID == "" {
		http.Error(w, "peer_id is required", http.StatusBadRequest)
		return
	}

	// Ensure users are ordered consistently for unique constraint
	user1, user2 := userID, req.PeerID
	if user1 > user2 {
		user1, user2 = user2, user1
	}

	// Check if DM already exists
	existingSpace, err := h.store.FindDMSpace(user1, user2)
	if err == nil && existingSpace != nil {
		// DM already exists
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"space_id":           existingSpace.SpaceID,
			"user_id":           userID,
			"peer_id":           req.PeerID,
			"is_e2e_enabled":    existingSpace.IsE2EEnabled,
			"session_established": h.checkSessionEstablished(userID, req.PeerID),
			"created_at":        existingSpace.CreatedAt,
		})
		return
	}

	// Create new DM space
	spaceID := fmt.Sprintf("dm_%s", uuid.New().String())
	
	if err := h.store.CreateDMSpace(spaceID, user1, user2, req.EnableE2E); err != nil {
		http.Error(w, "Failed to create DM space", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"space_id":           spaceID,
		"user_id":           userID,
		"peer_id":           req.PeerID,
		"is_e2e_enabled":    req.EnableE2E,
		"session_established": false,
		"created_at":        "now",
	})
}

// FindDM finds an existing DM space between two users
// GET /api/e2e/dm/find?peer_id=xxx
func (h *SpaceHandler) FindDM(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	peerID := r.URL.Query().Get("peer_id")
	if peerID == "" {
		http.Error(w, "peer_id is required", http.StatusBadRequest)
		return
	}

	// Ensure users are ordered consistently
	user1, user2 := userID, peerID
	if user1 > user2 {
		user1, user2 = user2, user1
	}

	dmSpace, err := h.store.FindDMSpace(user1, user2)
	if err != nil || dmSpace == nil {
		http.Error(w, "DM not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"space_id":           dmSpace.SpaceID,
		"user_id":           userID,
		"peer_id":           peerID,
		"is_e2e_enabled":    dmSpace.IsE2EEnabled,
		"session_established": h.checkSessionEstablished(userID, peerID),
		"created_at":        dmSpace.CreatedAt,
	})
}

// ListDMs lists all DM spaces for the current user
// GET /api/e2e/dm/list
func (h *SpaceHandler) ListDMs(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	dms, err := h.store.GetUserDMSpaces(userID)
	if err != nil {
		http.Error(w, "Failed to fetch DMs", http.StatusInternalServerError)
		return
	}

	// Format response
	dmList := make([]map[string]interface{}, 0, len(dms))
	for _, dm := range dms {
		// Determine peer ID
		peerID := dm.User2ID
		if dm.User2ID == userID {
			peerID = dm.User1ID
		}

		dmList = append(dmList, map[string]interface{}{
			"space_id":           dm.SpaceID,
			"user_id":           userID,
			"peer_id":           peerID,
			"is_e2e_enabled":    dm.IsE2EEnabled,
			"session_established": h.checkSessionEstablished(userID, peerID),
			"created_at":        dm.CreatedAt,
			"last_message_at":   dm.LastMessageAt,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"dms": dmList,
	})
}

// GetSpaceType returns the type of a space (dm or group)
// GET /api/e2e/space/{spaceId}/type
func (h *SpaceHandler) GetSpaceType(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	spaceID := vars["spaceId"]

	spaceInfo, err := h.store.GetE2ESpace(spaceID)
	if err != nil {
		http.Error(w, "Space not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"space_id":      spaceID,
		"space_type":    spaceInfo.SpaceType,
		"is_e2e_enabled": spaceInfo.IsE2EEnabled,
		"member_count":  spaceInfo.MemberCount,
	})
}

// EnableE2EForSpace enables E2E encryption for a space
// POST /api/e2e/space/{spaceId}/enable-e2e
func (h *SpaceHandler) EnableE2EForSpace(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	spaceID := vars["spaceId"]

	// Check if user is a member of the space
	isMember, err := h.store.IsSpaceMember(spaceID, userID)
	if err != nil || !isMember {
		http.Error(w, "Not a member of this space", http.StatusForbidden)
		return
	}

	// Enable E2E
	if err := h.store.EnableE2EForSpace(spaceID); err != nil {
		http.Error(w, "Failed to enable E2E", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"space_id": spaceID,
		"is_e2e_enabled": true,
	})
}

// CreateGroupRequest represents a request to create an E2E group
type CreateGroupRequest struct {
	GroupID   string   `json:"group_id"`
	MemberIDs []string `json:"member_ids"`
}

// CreateE2EGroup creates a new E2E encrypted group space
// POST /api/e2e/group/create-space
func (h *SpaceHandler) CreateE2EGroup(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.GroupID == "" {
		req.GroupID = fmt.Sprintf("group_%s", uuid.New().String())
	}

	// Create E2E group space
	if err := h.store.CreateE2EGroupSpace(req.GroupID, userID, req.MemberIDs); err != nil {
		http.Error(w, "Failed to create group space", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"group_id": req.GroupID,
		"space_type": "group",
		"is_e2e_enabled": true,
		"created_by": userID,
		"member_count": len(req.MemberIDs) + 1,
	})
}

// checkSessionEstablished checks if a Signal session is established between two users
func (h *SpaceHandler) checkSessionEstablished(userID, peerID string) bool {
	// Check if session exists in the sessions table
	exists, _ := h.store.SessionExists(userID, peerID)
	return exists
}

// AcceptDM accepts an incoming DM invitation
func (h *SpaceHandler) AcceptDM(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	
	vars := mux.Vars(r)
	spaceID := vars["spaceId"]
	
	if spaceID == "" {
		http.Error(w, "Space ID required", http.StatusBadRequest)
		return
	}
	
	// For now, just return success - actual invitation logic would go here
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "accepted",
		"space_id": spaceID,
		"user_id": userID,
	})
}

// DeclineDM declines an incoming DM invitation
func (h *SpaceHandler) DeclineDM(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	
	vars := mux.Vars(r)
	spaceID := vars["spaceId"]
	
	if spaceID == "" {
		http.Error(w, "Space ID required", http.StatusBadRequest)
		return
	}
	
	// For now, just return success - actual invitation logic would go here
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "declined",
		"space_id": spaceID,
		"user_id": userID,
	})
}

// Helper to extract space type from space ID
func getSpaceTypeFromID(spaceID string) string {
	if strings.HasPrefix(spaceID, "dm_") {
		return "dm"
	} else if strings.HasPrefix(spaceID, "group_") {
		return "group"
	}
	return "unknown"
}