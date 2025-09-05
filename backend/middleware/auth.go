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

package middleware

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// Claims represents the JWT claims structure
type Claims struct {
	UserID    string   `json:"user_id"`
	Email     string   `json:"email"`
	Username  string   `json:"username"`
	Roles     []string `json:"roles"`
	ExpiresAt int64    `json:"exp"`
	IssuedAt  int64    `json:"iat"`
	Issuer    string   `json:"iss"`
}

// JWTConfig holds the JWT configuration
type JWTConfig struct {
	Secret string
	Issuer string
}

// NewAuthMiddleware creates a new authentication middleware
func NewAuthMiddleware(jwtSecret string, issuer string) func(http.Handler) http.Handler {
	config := &JWTConfig{
		Secret: jwtSecret,
		Issuer: issuer,
	}
	
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Unauthorized: No authorization header", http.StatusUnauthorized)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
				return
			}

			token := parts[1]
			
			// Verify and parse JWT token
			claims, err := verifyJWT(token, config)
			if err != nil {
				http.Error(w, fmt.Sprintf("Invalid token: %v", err), http.StatusUnauthorized)
				return
			}

			// Check expiration
			if time.Now().Unix() > claims.ExpiresAt {
				http.Error(w, "Token expired", http.StatusUnauthorized)
				return
			}

			// Verify issuer if configured
			if config.Issuer != "" && claims.Issuer != config.Issuer {
				http.Error(w, "Invalid token issuer", http.StatusUnauthorized)
				return
			}

			// Add user ID and claims to context
			ctx := context.WithValue(r.Context(), "user_id", claims.UserID)
			ctx = context.WithValue(ctx, "claims", claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// verifyJWT verifies and parses a JWT token
func verifyJWT(token string, config *JWTConfig) (*Claims, error) {
	// Split token into parts
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid token format")
	}

	// Decode header
	headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("failed to decode header: %v", err)
	}

	var header map[string]interface{}
	if err := json.Unmarshal(headerJSON, &header); err != nil {
		return nil, fmt.Errorf("failed to parse header: %v", err)
	}

	// Check algorithm
	alg, ok := header["alg"].(string)
	if !ok || alg != "HS256" {
		return nil, fmt.Errorf("unsupported algorithm: %v", alg)
	}

	// Verify signature
	message := parts[0] + "." + parts[1]
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("failed to decode signature: %v", err)
	}

	// Calculate expected signature
	h := hmac.New(sha256.New, []byte(config.Secret))
	h.Write([]byte(message))
	expectedSignature := h.Sum(nil)

	// Compare signatures
	if !hmac.Equal(signature, expectedSignature) {
		return nil, fmt.Errorf("invalid signature")
	}

	// Decode and parse claims
	claimsJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("failed to decode claims: %v", err)
	}

	var claims Claims
	if err := json.Unmarshal(claimsJSON, &claims); err != nil {
		return nil, fmt.Errorf("failed to parse claims: %v", err)
	}

	return &claims, nil
}

// GetUserID extracts the user ID from the request context
func GetUserID(r *http.Request) (string, bool) {
	userID, ok := r.Context().Value("user_id").(string)
	return userID, ok
}

// GetClaims extracts the full claims from the request context
func GetClaims(r *http.Request) (*Claims, bool) {
	claims, ok := r.Context().Value("claims").(*Claims)
	return claims, ok
}

// CORS middleware for handling cross-origin requests
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		
		// In production, check against allowed origins list
		allowedOrigins := []string{
			"https://efchat.net",
			"https://app.efchat.net",
			"http://localhost:3000", // Development
		}
		
		for _, allowed := range allowedOrigins {
			if origin == allowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}
		
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}