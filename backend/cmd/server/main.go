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

package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	
	"github.com/efchatnet/efsec/backend/handlers"
	"github.com/efchatnet/efsec/backend/middleware"
	"github.com/efchatnet/efsec/backend/storage/postgres"
)

func main() {
	// Database connection
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://localhost/efsec?sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Redis connection
	redisAddr := os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	rdb := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	// Initialize storage
	store := postgres.NewStore(db, rdb)

	// Run migrations
	if err := store.Migrate(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize handlers
	keyHandler := handlers.NewKeyHandler(store)
	groupHandler := handlers.NewGroupHandler(store)
	dmHandler := handlers.NewDMHandler(store)

	// Get JWT configuration from environment
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}

	jwtIssuer := os.Getenv("JWT_ISSUER")
	if jwtIssuer == "" {
		jwtIssuer = "efchat"
	}

	// Create auth middleware
	authMiddleware := middleware.NewAuthMiddleware(jwtSecret, jwtIssuer)

	// Setup router
	r := mux.NewRouter()
	
	// Apply CORS middleware
	r.Use(middleware.CORS)
	
	// API routes
	api := r.PathPrefix("/api/e2e").Subrouter()
	api.Use(authMiddleware)

	// Key management endpoints
	api.HandleFunc("/keys", keyHandler.RegisterKeys).Methods("POST")
	api.HandleFunc("/bundle/{userId}", keyHandler.GetPreKeyBundle).Methods("GET")
	api.HandleFunc("/keys/replenish", keyHandler.ReplenishPreKeys).Methods("POST")

	// Group endpoints
	api.HandleFunc("/group/create", groupHandler.CreateGroup).Methods("POST")
	api.HandleFunc("/group/{groupId}/join", groupHandler.JoinGroup).Methods("POST")
	api.HandleFunc("/group/{groupId}/leave", groupHandler.LeaveGroup).Methods("POST")
	api.HandleFunc("/group/{groupId}/members", groupHandler.GetGroupMembers).Methods("GET")
	api.HandleFunc("/group/{groupId}/message", groupHandler.SendGroupMessage).Methods("POST")

	// DM endpoints (for encrypted direct messages and key distribution)
	api.HandleFunc("/dm/send", dmHandler.SendDM).Methods("POST")
	api.HandleFunc("/dm/messages", dmHandler.GetDMs).Methods("GET")
	api.HandleFunc("/dm/messages/{userId}", dmHandler.GetDMsWith).Methods("GET")
	api.HandleFunc("/dm/message/{messageId}/read", dmHandler.MarkDMRead).Methods("POST")
	api.HandleFunc("/dm/message/{messageId}", dmHandler.DeleteDM).Methods("DELETE")

	// Health check (no auth required)
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		// Check database connection
		if err := db.Ping(); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("Database unavailable"))
			return
		}
		
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}).Methods("GET")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("E2E server starting on port %s", port)
	log.Printf("JWT Issuer: %s", jwtIssuer)
	
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}