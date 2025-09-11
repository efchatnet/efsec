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

package postgres

import (
	"database/sql"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/efchatnet/efsec/backend/models"
	redisStore "github.com/efchatnet/efsec/backend/storage/redis"
)

type Store struct {
	db      *sql.DB
	redis   *redis.Client
	dmStore *redisStore.DMStore
}

func NewStore(db *sql.DB, redis *redis.Client) *Store {
	return &Store{
		db:      db,
		redis:   redis,
		dmStore: redisStore.NewDMStore(redis),
	}
}

func (s *Store) SaveIdentityKey(userID string, registration models.KeyRegistration) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Save identity key
	_, err = tx.Exec(`
		INSERT INTO identity_keys (user_id, public_key, registration_id, created_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id) DO UPDATE
		SET public_key = $2, registration_id = $3, created_at = $4`,
		userID, registration.IdentityPublicKey, registration.RegistrationID, time.Now())
	if err != nil {
		return err
	}

	// Save signed prekey
	_, err = tx.Exec(`
		INSERT INTO signed_pre_keys (user_id, key_id, public_key, signature, created_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, key_id) DO UPDATE
		SET public_key = $3, signature = $4, created_at = $5`,
		userID, registration.SignedPreKey.KeyID, registration.SignedPreKey.PublicKey,
		registration.SignedPreKey.Signature, time.Now())
	if err != nil {
		return err
	}

	// Save one-time prekeys
	for _, prekey := range registration.OneTimePreKeys {
		_, err = tx.Exec(`
			INSERT INTO one_time_pre_keys (user_id, key_id, public_key, used, created_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (user_id, key_id) DO NOTHING`,
			userID, prekey.KeyID, prekey.PublicKey, false, time.Now())
		if err != nil {
			return err
		}
	}

	// Save Kyber prekeys if provided
	for _, kyberKey := range registration.KyberPreKeys {
		_, err = tx.Exec(`
			INSERT INTO kyber_pre_keys (user_id, key_id, public_key, signature, used, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (user_id, key_id) DO NOTHING`,
			userID, kyberKey.KeyID, kyberKey.PublicKey, kyberKey.Signature, false, time.Now())
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Store) GetPreKeyBundle(userID string) (*models.PreKeyBundle, error) {
	bundle := &models.PreKeyBundle{}

	// Get identity key
	err := s.db.QueryRow(`
		SELECT public_key, registration_id FROM identity_keys
		WHERE user_id = $1`, userID).Scan(
		&bundle.IdentityPublicKey, &bundle.RegistrationID)
	if err != nil {
		// Log the exact error and user ID for debugging
		if err == sql.ErrNoRows {
			// Check if user exists at all in database
			var count int
			s.db.QueryRow(`SELECT COUNT(*) FROM identity_keys WHERE user_id = $1`, userID).Scan(&count)
			// This will show in server logs: "No identity key found for user: X (exists: Y)"
		}
		return nil, err
	}

	// Get signed prekey
	err = s.db.QueryRow(`
		SELECT key_id, public_key, signature FROM signed_pre_keys
		WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, userID).Scan(
		&bundle.SignedPreKey.KeyID, &bundle.SignedPreKey.PublicKey,
		&bundle.SignedPreKey.Signature)
	if err != nil {
		return nil, err
	}

	// Get one unused one-time prekey and mark it as used
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var prekey models.OneTimePreKey
	err = tx.QueryRow(`
		SELECT key_id, public_key FROM one_time_pre_keys
		WHERE user_id = $1 AND used = false
		ORDER BY key_id LIMIT 1
		FOR UPDATE`, userID).Scan(&prekey.KeyID, &prekey.PublicKey)
	
	if err == nil {
		// Mark as used
		_, err = tx.Exec(`
			UPDATE one_time_pre_keys SET used = true
			WHERE user_id = $1 AND key_id = $2`,
			userID, prekey.KeyID)
		if err != nil {
			return nil, err
		}
		bundle.OneTimePreKey = &prekey
	} else if err != sql.ErrNoRows {
		return nil, err
	}

	// Try to get an unused Kyber prekey
	var kyberKey models.KyberPreKey
	err = tx.QueryRow(`
		SELECT key_id, public_key, signature FROM kyber_pre_keys
		WHERE user_id = $1 AND used = false
		ORDER BY key_id LIMIT 1
		FOR UPDATE`, userID).Scan(&kyberKey.KeyID, &kyberKey.PublicKey, &kyberKey.Signature)
	
	if err == nil {
		// Mark as used
		_, err = tx.Exec(`
			UPDATE kyber_pre_keys SET used = true
			WHERE user_id = $1 AND key_id = $2`,
			userID, kyberKey.KeyID)
		if err != nil {
			return nil, err
		}
		bundle.KyberPreKey = &kyberKey
	} else if err != sql.ErrNoRows {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}

	// Validate bundle has required data
	if bundle.RegistrationID == 0 || len(bundle.IdentityPublicKey) == 0 {
		return nil, sql.ErrNoRows // Treat as "user not found" to force re-registration
	}

	return bundle, nil
}

func (s *Store) AddOneTimePreKeys(userID string, prekeys []models.OneTimePreKey) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, prekey := range prekeys {
		_, err = tx.Exec(`
			INSERT INTO one_time_pre_keys (user_id, key_id, public_key, used, created_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (user_id, key_id) DO NOTHING`,
			userID, prekey.KeyID, prekey.PublicKey, false, time.Now())
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Store) MarkPreKeyUsed(userID string, keyID int) error {
	_, err := s.db.Exec(`
		UPDATE one_time_pre_keys SET used = true
		WHERE user_id = $1 AND key_id = $2`,
		userID, keyID)
	return err
}

func (s *Store) GetUnusedPreKeyCount(userID string) (int, error) {
	var count int
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM one_time_pre_keys
		WHERE user_id = $1 AND used = false`,
		userID).Scan(&count)
	return count, err
}

// Kyber prekey methods (post-quantum resistant)

func (s *Store) AddKyberPreKeys(userID string, prekeys []models.KyberPreKey) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, kyberKey := range prekeys {
		_, err = tx.Exec(`
			INSERT INTO kyber_pre_keys (user_id, key_id, public_key, signature, used, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (user_id, key_id) DO NOTHING`,
			userID, kyberKey.KeyID, kyberKey.PublicKey, kyberKey.Signature, false, time.Now())
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Store) GetUnusedKyberPreKey(userID string) (*models.KyberPreKey, error) {
	var kyberKey models.KyberPreKey
	err := s.db.QueryRow(`
		SELECT key_id, public_key, signature FROM kyber_pre_keys
		WHERE user_id = $1 AND used = false
		ORDER BY key_id LIMIT 1`,
		userID).Scan(&kyberKey.KeyID, &kyberKey.PublicKey, &kyberKey.Signature)
	
	if err != nil {
		return nil, err
	}
	
	kyberKey.UserID = userID
	return &kyberKey, nil
}

func (s *Store) MarkKyberPreKeyUsed(userID string, keyID int) error {
	_, err := s.db.Exec(`
		UPDATE kyber_pre_keys SET used = true
		WHERE user_id = $1 AND key_id = $2`,
		userID, keyID)
	return err
}

func (s *Store) GetUnusedKyberPreKeyCount(userID string) (int, error) {
	var count int
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM kyber_pre_keys
		WHERE user_id = $1 AND used = false`,
		userID).Scan(&count)
	return count, err
}