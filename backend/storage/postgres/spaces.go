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

	"github.com/efchatnet/efsec/backend/models"
)

// CreateDMSpace creates a new DM space between two users
func (s *Store) CreateDMSpace(spaceID, user1ID, user2ID string, enableE2E bool) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Create E2E space entry
	_, err = tx.Exec(`
		INSERT INTO e2e_spaces (space_id, space_type, is_e2e_enabled, created_by, member_count)
		VALUES ($1, 'dm', $2, $3, 2)
	`, spaceID, enableE2E, user1ID)
	if err != nil {
		return err
	}

	// Create DM space entry
	_, err = tx.Exec(`
		INSERT INTO dm_spaces (space_id, user1_id, user2_id)
		VALUES ($1, $2, $3)
	`, spaceID, user1ID, user2ID)
	if err != nil {
		return err
	}

	// Add members to E2E space
	_, err = tx.Exec(`
		INSERT INTO e2e_space_members (space_id, user_id)
		VALUES ($1, $2), ($1, $3)
	`, spaceID, user1ID, user2ID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// FindDMSpace finds an existing DM space between two users
func (s *Store) FindDMSpace(user1ID, user2ID string) (*models.DMSpace, error) {
	var dm models.DMSpace
	var lastMessageAt sql.NullTime

	err := s.db.QueryRow(`
		SELECT d.space_id, d.user1_id, d.user2_id, e.is_e2e_enabled, 
		       d.created_at, d.last_message_at
		FROM dm_spaces d
		JOIN e2e_spaces e ON d.space_id = e.space_id
		WHERE (d.user1_id = $1 AND d.user2_id = $2) 
		   OR (d.user1_id = $2 AND d.user2_id = $1)
	`, user1ID, user2ID).Scan(
		&dm.SpaceID, &dm.User1ID, &dm.User2ID, &dm.IsE2EEnabled,
		&dm.CreatedAt, &lastMessageAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if lastMessageAt.Valid {
		dm.LastMessageAt = &lastMessageAt.Time
	}

	return &dm, nil
}

// GetUserDMSpaces gets all DM spaces for a user
func (s *Store) GetUserDMSpaces(userID string) ([]models.DMSpace, error) {
	rows, err := s.db.Query(`
		SELECT d.space_id, d.user1_id, d.user2_id, e.is_e2e_enabled, 
		       d.created_at, d.last_message_at
		FROM dm_spaces d
		JOIN e2e_spaces e ON d.space_id = e.space_id
		WHERE d.user1_id = $1 OR d.user2_id = $1
		ORDER BY COALESCE(d.last_message_at, d.created_at) DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dms []models.DMSpace
	for rows.Next() {
		var dm models.DMSpace
		var lastMessageAt sql.NullTime

		err := rows.Scan(
			&dm.SpaceID, &dm.User1ID, &dm.User2ID, &dm.IsE2EEnabled,
			&dm.CreatedAt, &lastMessageAt,
		)
		if err != nil {
			return nil, err
		}

		if lastMessageAt.Valid {
			dm.LastMessageAt = &lastMessageAt.Time
		}

		dms = append(dms, dm)
	}

	return dms, rows.Err()
}

// CreateE2EGroupSpace creates a new E2E encrypted group space
func (s *Store) CreateE2EGroupSpace(spaceID, createdBy string, memberIDs []string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Create E2E space entry
	_, err = tx.Exec(`
		INSERT INTO e2e_spaces (space_id, space_type, is_e2e_enabled, created_by, member_count)
		VALUES ($1, 'group', true, $2, $3)
	`, spaceID, createdBy, len(memberIDs)+1)
	if err != nil {
		return err
	}

	// Add creator as first member
	_, err = tx.Exec(`
		INSERT INTO e2e_space_members (space_id, user_id)
		VALUES ($1, $2)
	`, spaceID, createdBy)
	if err != nil {
		return err
	}

	// Add other members
	for _, memberID := range memberIDs {
		_, err = tx.Exec(`
			INSERT INTO e2e_space_members (space_id, user_id)
			VALUES ($1, $2)
		`, spaceID, memberID)
		if err != nil {
			return err
		}
	}

	// Also create group in the groups table for Signal protocol
	_, err = tx.Exec(`
		INSERT INTO groups (group_id, created_by)
		VALUES ($1, $2)
	`, spaceID, createdBy)
	if err != nil {
		return err
	}

	// Add members to group_members table
	for _, memberID := range append(memberIDs, createdBy) {
		_, err = tx.Exec(`
			INSERT INTO group_members (group_id, user_id)
			VALUES ($1, $2)
		`, spaceID, memberID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// GetE2ESpace gets information about an E2E space
func (s *Store) GetE2ESpace(spaceID string) (*models.E2ESpace, error) {
	var space models.E2ESpace

	err := s.db.QueryRow(`
		SELECT space_id, space_type, is_e2e_enabled, created_by, created_at, member_count
		FROM e2e_spaces
		WHERE space_id = $1
	`, spaceID).Scan(
		&space.SpaceID, &space.SpaceType, &space.IsE2EEnabled,
		&space.CreatedBy, &space.CreatedAt, &space.MemberCount,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &space, nil
}

// EnableE2EForSpace enables E2E encryption for a space
func (s *Store) EnableE2EForSpace(spaceID string) error {
	_, err := s.db.Exec(`
		UPDATE e2e_spaces
		SET is_e2e_enabled = true
		WHERE space_id = $1
	`, spaceID)
	return err
}

// IsSpaceMember checks if a user is a member of a space
func (s *Store) IsSpaceMember(spaceID, userID string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM e2e_space_members
			WHERE space_id = $1 AND user_id = $2
		)
	`, spaceID, userID).Scan(&exists)
	return exists, err
}

// SessionExists checks if a Signal session exists between two users
func (s *Store) SessionExists(userID, peerID string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM sessions
			WHERE (user_id = $1 AND peer_id = $2)
			   OR (user_id = $2 AND peer_id = $1)
		)
	`, userID, peerID).Scan(&exists)
	return exists, err
}

// UpdateLastMessage updates the last message timestamp for a DM
func (s *Store) UpdateLastMessage(spaceID string) error {
	_, err := s.db.Exec(`
		UPDATE dm_spaces
		SET last_message_at = CURRENT_TIMESTAMP
		WHERE space_id = $1
	`, spaceID)
	return err
}