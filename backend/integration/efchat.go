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

package integration

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	
	"github.com/gorilla/mux"
	"github.com/redis/go-redis/v9"
	
	"github.com/efchatnet/efsec/backend/handlers"
	"github.com/efchatnet/efsec/backend/middleware"
	"github.com/efchatnet/efsec/backend/storage/postgres"
)

// E2EIntegration provides E2E encryption functionality as a plugin for efchat
type E2EIntegration struct {
	store         *postgres.Store
	keyHandler    *handlers.KeyHandler
	groupHandler  *handlers.GroupHandler
	dmHandler     *handlers.DMHandler
	spaceHandler  *handlers.SpaceHandler
	jwtSecret     string
	jwtIssuer     string
}

// Config holds configuration for the E2E integration
type Config struct {
	DB        *sql.DB
	Redis     *redis.Client
	JWTSecret string
	JWTIssuer string
}

// NewE2EIntegration creates a new E2E integration that can be embedded into efchat
func NewE2EIntegration(config *Config) (*E2EIntegration, error) {
	store := postgres.NewStore(config.DB, config.Redis)
	
	// Run migrations
	if err := store.Migrate(); err != nil {
		return nil, err
	}
	
	return &E2EIntegration{
		store:        store,
		keyHandler:   handlers.NewKeyHandler(store),
		groupHandler: handlers.NewGroupHandler(store),
		dmHandler:    handlers.NewDMHandler(store),
		spaceHandler: handlers.NewSpaceHandler(store),
		jwtSecret:    config.JWTSecret,
		jwtIssuer:    config.JWTIssuer,
	}, nil
}

// RegisterRoutes adds E2E routes to an existing router
// If authMiddleware is nil, it will use the built-in JWT validation
func (e *E2EIntegration) RegisterRoutes(router *mux.Router, authMiddleware func(http.Handler) http.Handler) {
	// Create subrouter for E2E endpoints
	api := router.PathPrefix("/api/e2e").Subrouter()
	
	// Use provided auth middleware or create our own
	if authMiddleware != nil {
		api.Use(authMiddleware)
	} else {
		// Use our own JWT validation
		api.Use(middleware.NewAuthMiddleware(e.jwtSecret, e.jwtIssuer))
	}
	
	// Key management endpoints
	api.HandleFunc("/keys", e.keyHandler.RegisterKeys).Methods("POST", "OPTIONS")
	api.HandleFunc("/bundle/{user_id}", e.keyHandler.GetPreKeyBundle).Methods("GET", "OPTIONS")
	api.HandleFunc("/keys/replenish", e.keyHandler.ReplenishPreKeys).Methods("POST", "OPTIONS")
	api.HandleFunc("/keys/status", e.GetKeyStatus).Methods("GET", "OPTIONS")
	
	// DM space endpoints
	api.HandleFunc("/dm/initiate", e.spaceHandler.InitiateDM).Methods("POST", "OPTIONS")
	api.HandleFunc("/dm/find", e.spaceHandler.FindDM).Methods("GET", "OPTIONS")
	api.HandleFunc("/dm/list", e.spaceHandler.ListDMs).Methods("GET", "OPTIONS")
	
	// Space management endpoints
	api.HandleFunc("/space/{spaceId}/type", e.spaceHandler.GetSpaceType).Methods("GET", "OPTIONS")
	api.HandleFunc("/space/{spaceId}/enable-e2e", e.spaceHandler.EnableE2EForSpace).Methods("POST", "OPTIONS")
	
	// Group endpoints
	api.HandleFunc("/group/create", e.groupHandler.CreateGroup).Methods("POST", "OPTIONS")
	api.HandleFunc("/group/create-space", e.spaceHandler.CreateE2EGroup).Methods("POST", "OPTIONS")
	api.HandleFunc("/group/{groupId}/join", e.groupHandler.JoinGroup).Methods("POST", "OPTIONS")
	api.HandleFunc("/group/{groupId}/members", e.groupHandler.GetGroupMembers).Methods("GET", "OPTIONS")
	api.HandleFunc("/group/{groupId}/message", e.groupHandler.SendGroupMessage).Methods("POST", "OPTIONS")
	api.HandleFunc("/group/{groupId}/leave", e.groupHandler.LeaveGroup).Methods("POST", "OPTIONS")
	api.HandleFunc("/group/{groupId}/rekey", e.rekeyGroup).Methods("POST", "OPTIONS")
	
	// DM endpoints (for encrypted direct messages and key distribution)
	api.HandleFunc("/dm/send", e.dmHandler.SendDM).Methods("POST", "OPTIONS")
	api.HandleFunc("/dm/messages", e.dmHandler.GetDMs).Methods("GET", "OPTIONS")
	api.HandleFunc("/dm/messages/{user_id}", e.dmHandler.GetDMsWith).Methods("GET", "OPTIONS")
	api.HandleFunc("/dm/message/{messageId}/read", e.dmHandler.MarkDMRead).Methods("POST", "OPTIONS")
	api.HandleFunc("/dm/message/{messageId}", e.dmHandler.DeleteDM).Methods("DELETE", "OPTIONS")
}

// GetStore returns the underlying storage implementation
func (e *E2EIntegration) GetStore() *postgres.Store {
	return e.store
}

// CheckPreKeyCount checks if a user needs to replenish their one-time prekeys
func (e *E2EIntegration) CheckPreKeyCount(userID string, threshold int) (bool, error) {
	count, err := e.store.GetUnusedPreKeyCount(userID)
	if err != nil {
		return false, err
	}
	return count < threshold, nil
}

// GetKeyStatus returns the current key status for a user
func (e *E2EIntegration) GetKeyStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	count, err := e.store.GetUnusedPreKeyCount(userID)
	if err != nil {
		http.Error(w, "Failed to get key count", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"remaining_keys": count,
	})
}


// rekeyGroup initiates a key rotation for a group
func (e *E2EIntegration) rekeyGroup(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupID := vars["groupId"]

	// Check if user is a member
	members, err := e.store.GetGroupMembers(groupID)
	if err != nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	isMember := false
	for _, member := range members {
		if member == userID {
			isMember = true
			break
		}
	}

	if !isMember {
		http.Error(w, "Not a group member", http.StatusForbidden)
		return
	}

	// Increment key version for the group
	if err := e.store.IncrementKeyVersion(groupID); err != nil {
		http.Error(w, "Failed to rotate keys", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"rekeyed"}`))
}

// ValidateSetup checks if the E2E module is properly configured
func (e *E2EIntegration) ValidateSetup() error {
	// Check database connection
	if err := e.store.Migrate(); err != nil {
		return err
	}

	// Validate JWT configuration
	if e.jwtSecret == "" {
		return &ValidationError{Message: "JWT secret is not configured"}
	}

	return nil
}

// ValidationError represents a configuration validation error
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

// Handler getters for bridge integration
func (e *E2EIntegration) GetKeyHandler() *handlers.KeyHandler {
	return e.keyHandler
}

func (e *E2EIntegration) GetDMHandler() *handlers.DMHandler {
	return e.dmHandler
}

func (e *E2EIntegration) GetGroupHandler() *handlers.GroupHandler {
	return e.groupHandler
}

func (e *E2EIntegration) GetSpaceHandler() *handlers.SpaceHandler {
	return e.spaceHandler
}


func (e *E2EIntegration) RekeyGroup(w http.ResponseWriter, r *http.Request) {
	e.rekeyGroup(w, r)
}

// CleanupDMSession removes all E2E session data for a DM space
func (e *E2EIntegration) CleanupDMSession(spaceID string) error {
	// Extract user IDs from DM space ID format: dm-user1-user2
	if !strings.HasPrefix(spaceID, "dm-") {
		return nil // Not a DM space
	}
	
	// Parse DM space ID to get the two user IDs
	parts := strings.Split(spaceID, "-")
	if len(parts) < 3 {
		return fmt.Errorf("invalid DM space ID format: %s", spaceID)
	}
	
	user1 := parts[1]
	user2 := parts[2]
	
	// Clean up DM records between these users
	if err := e.store.DeleteDMsBetweenUsers(user1, user2); err != nil {
		return fmt.Errorf("failed to delete DMs between %s and %s: %w", user1, user2, err)
	}
	
	log.Printf("[E2E-Cleanup] Cleaned up DM session data for space %s (%s <-> %s)", spaceID, user1, user2)
	return nil
}