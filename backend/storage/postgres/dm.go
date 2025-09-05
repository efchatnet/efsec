// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package postgres

import (
	"time"
	"github.com/efchatnet/efsec/backend/models"
)

func (s *Store) SaveDM(dm models.EncryptedDM) error {
	_, err := s.db.Exec(`
		INSERT INTO encrypted_dms (message_id, sender_id, recipient_id, ciphertext, message_type, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		dm.MessageID, dm.SenderID, dm.RecipientID, dm.Ciphertext,
		dm.MessageType, time.Now())
	return err
}

func (s *Store) GetDMsForUser(userID string, messageType string, limit int) ([]models.EncryptedDM, error) {
	query := `
		SELECT message_id, sender_id, recipient_id, ciphertext, message_type, created_at, read_at
		FROM encrypted_dms
		WHERE recipient_id = $1`
	
	args := []interface{}{userID}
	
	if messageType != "" {
		query += " AND message_type = $2"
		args = append(args, messageType)
		query += " ORDER BY created_at DESC LIMIT $3"
		args = append(args, limit)
	} else {
		query += " ORDER BY created_at DESC LIMIT $2"
		args = append(args, limit)
	}
	
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var dms []models.EncryptedDM
	for rows.Next() {
		var dm models.EncryptedDM
		if err := rows.Scan(&dm.MessageID, &dm.SenderID, &dm.RecipientID,
			&dm.Ciphertext, &dm.MessageType, &dm.CreatedAt, &dm.ReadAt); err != nil {
			return nil, err
		}
		dms = append(dms, dm)
	}
	
	return dms, rows.Err()
}

func (s *Store) GetDMsBetweenUsers(userID1, userID2 string, limit int) ([]models.EncryptedDM, error) {
	rows, err := s.db.Query(`
		SELECT message_id, sender_id, recipient_id, ciphertext, message_type, created_at, read_at
		FROM encrypted_dms
		WHERE (sender_id = $1 AND recipient_id = $2) 
		   OR (sender_id = $2 AND recipient_id = $1)
		ORDER BY created_at DESC
		LIMIT $3`,
		userID1, userID2, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var dms []models.EncryptedDM
	for rows.Next() {
		var dm models.EncryptedDM
		if err := rows.Scan(&dm.MessageID, &dm.SenderID, &dm.RecipientID,
			&dm.Ciphertext, &dm.MessageType, &dm.CreatedAt, &dm.ReadAt); err != nil {
			return nil, err
		}
		dms = append(dms, dm)
	}
	
	return dms, rows.Err()
}

func (s *Store) MarkDMAsRead(messageID, userID string) error {
	_, err := s.db.Exec(`
		UPDATE encrypted_dms
		SET read_at = $1
		WHERE message_id = $2 AND recipient_id = $3`,
		time.Now(), messageID, userID)
	return err
}

func (s *Store) DeleteDMForUser(messageID, userID string) error {
	// Only allow deletion if user is the recipient
	_, err := s.db.Exec(`
		DELETE FROM encrypted_dms
		WHERE message_id = $1 AND recipient_id = $2`,
		messageID, userID)
	return err
}