// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package postgres

import (
	"github.com/efchatnet/efsec/backend/models"
)

// DM operations are delegated to Redis for ephemeral storage

func (s *Store) SaveDM(dm models.EncryptedDM) error {
	return s.dmStore.SaveDM(dm)
}

func (s *Store) GetDMsForUser(userID string, messageType string, limit int) ([]models.EncryptedDM, error) {
	return s.dmStore.GetDMsForUser(userID, messageType, limit)
}

func (s *Store) GetDMsBetweenUsers(userID1, userID2 string, limit int) ([]models.EncryptedDM, error) {
	return s.dmStore.GetDMsBetweenUsers(userID1, userID2, limit)
}

func (s *Store) MarkDMAsRead(messageID, userID string) error {
	return s.dmStore.MarkDMAsRead(messageID, userID)
}

func (s *Store) DeleteDMForUser(messageID, userID string) error {
	return s.dmStore.DeleteDMForUser(messageID, userID)
}