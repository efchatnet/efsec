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
	"time"
	"github.com/efchatnet/efsec/backend/models"
)

func (s *Store) CreateGroup(groupID string, creatorID string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Create group
	_, err = tx.Exec(`
		INSERT INTO groups (group_id, created_by, created_at)
		VALUES ($1, $2, $3)`,
		groupID, creatorID, time.Now())
	if err != nil {
		return err
	}

	// Add creator as member
	_, err = tx.Exec(`
		INSERT INTO group_members (group_id, user_id, joined_at, sender_key_version)
		VALUES ($1, $2, $3, $4)`,
		groupID, creatorID, time.Now(), 1)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (s *Store) AddGroupMember(groupID, userID string) error {
	_, err := s.db.Exec(`
		INSERT INTO group_members (group_id, user_id, joined_at, sender_key_version)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (group_id, user_id) DO NOTHING`,
		groupID, userID, time.Now(), 1)
	return err
}

func (s *Store) RemoveGroupMember(groupID, userID string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Remove member
	_, err = tx.Exec(`
		DELETE FROM group_members
		WHERE group_id = $1 AND user_id = $2`,
		groupID, userID)
	if err != nil {
		return err
	}

	// Remove their sender key
	_, err = tx.Exec(`
		DELETE FROM sender_keys
		WHERE group_id = $1 AND user_id = $2`,
		groupID, userID)
	if err != nil {
		return err
	}

	// Increment key version for group (forces rekey)
	_, err = tx.Exec(`
		UPDATE group_members
		SET sender_key_version = sender_key_version + 1
		WHERE group_id = $1`,
		groupID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (s *Store) GetGroupMembers(groupID string) ([]string, error) {
	rows, err := s.db.Query(`
		SELECT user_id FROM group_members
		WHERE group_id = $1`,
		groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []string
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		members = append(members, userID)
	}

	return members, rows.Err()
}

func (s *Store) SaveSenderKey(key models.SenderKey) error {
	_, err := s.db.Exec(`
		INSERT INTO sender_keys (group_id, user_id, public_signature_key, key_version, created_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (group_id, user_id) DO UPDATE
		SET public_signature_key = $3, key_version = $4, created_at = $5`,
		key.GroupID, key.UserID, key.PublicSignatureKey,
		key.KeyVersion, time.Now())
	return err
}

func (s *Store) GetGroupSenderKeys(groupID string) ([]models.SenderKey, error) {
	rows, err := s.db.Query(`
		SELECT group_id, user_id, public_signature_key, key_version, created_at
		FROM sender_keys
		WHERE group_id = $1`,
		groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []models.SenderKey
	for rows.Next() {
		var key models.SenderKey
		if err := rows.Scan(&key.GroupID, &key.UserID,
			&key.PublicSignatureKey, &key.KeyVersion, &key.CreatedAt); err != nil {
			return nil, err
		}
		keys = append(keys, key)
	}

	return keys, rows.Err()
}

func (s *Store) IncrementKeyVersion(groupID string) error {
	_, err := s.db.Exec(`
		UPDATE group_members
		SET sender_key_version = sender_key_version + 1
		WHERE group_id = $1`,
		groupID)
	return err
}

func (s *Store) SaveGroupMessage(msg models.EncryptedGroupMessage) error {
	_, err := s.db.Exec(`
		INSERT INTO encrypted_group_messages 
		(message_id, group_id, sender_id, ciphertext, signature, key_version, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		msg.MessageID, msg.GroupID, msg.SenderID, msg.Ciphertext,
		msg.Signature, msg.KeyVersion, time.Now())
	return err
}

func (s *Store) GetGroupMessages(groupID string, limit int) ([]models.EncryptedGroupMessage, error) {
	rows, err := s.db.Query(`
		SELECT message_id, group_id, sender_id, ciphertext, signature, key_version, created_at
		FROM encrypted_group_messages
		WHERE group_id = $1
		ORDER BY created_at DESC
		LIMIT $2`,
		groupID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []models.EncryptedGroupMessage
	for rows.Next() {
		var msg models.EncryptedGroupMessage
		if err := rows.Scan(&msg.MessageID, &msg.GroupID, &msg.SenderID,
			&msg.Ciphertext, &msg.Signature, &msg.KeyVersion, &msg.CreatedAt); err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}

	return messages, rows.Err()
}