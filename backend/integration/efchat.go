// Copyright (C) 2024 William Theesfeld <william@theesfeld.net>
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
	"net/http"
	
	"github.com/gorilla/mux"
	"github.com/redis/go-redis/v9"
	
	"github.com/efchatnet/efsec/backend/handlers"
	"github.com/efchatnet/efsec/backend/storage/postgres"
)

type E2EIntegration struct {
	store         *postgres.Store
	keyHandler    *handlers.KeyHandler
	groupHandler  *handlers.GroupHandler
}

// NewE2EIntegration creates a new E2E integration that can be embedded into efchat
func NewE2EIntegration(db *sql.DB, redis *redis.Client) (*E2EIntegration, error) {
	store := postgres.NewStore(db, redis)
	
	// Run migrations
	if err := store.Migrate(); err != nil {
		return nil, err
	}
	
	return &E2EIntegration{
		store:        store,
		keyHandler:   handlers.NewKeyHandler(store),
		groupHandler: handlers.NewGroupHandler(store),
	}, nil
}

// RegisterRoutes adds E2E routes to an existing router
func (e *E2EIntegration) RegisterRoutes(router *mux.Router, authMiddleware func(http.Handler) http.Handler) {
	// Create subrouter for E2E endpoints
	api := router.PathPrefix("/api/e2e").Subrouter()
	
	// Apply authentication middleware if provided
	if authMiddleware != nil {
		api.Use(authMiddleware)
	}
	
	// Key management endpoints
	api.HandleFunc("/keys", e.keyHandler.RegisterKeys).Methods("POST")
	api.HandleFunc("/bundle/{userId}", e.keyHandler.GetPreKeyBundle).Methods("GET")
	api.HandleFunc("/keys/replenish", e.keyHandler.ReplenishPreKeys).Methods("POST")
	
	// Group endpoints
	api.HandleFunc("/group/create", e.groupHandler.CreateGroup).Methods("POST")
	api.HandleFunc("/group/{groupId}/join", e.groupHandler.JoinGroup).Methods("POST")
	api.HandleFunc("/group/{groupId}/keys", e.groupHandler.GetGroupKeys).Methods("GET")
	api.HandleFunc("/group/{groupId}/message", e.groupHandler.SendGroupMessage).Methods("POST")
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