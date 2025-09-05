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

package storage

import (
	"github.com/efchatnet/efsec/backend/models"
)

type KeyStore interface {
	SaveIdentityKey(userID string, registration models.KeyRegistration) error
	GetPreKeyBundle(userID string) (*models.PreKeyBundle, error)
	AddOneTimePreKeys(userID string, prekeys []models.OneTimePreKey) error
	MarkPreKeyUsed(userID string, keyID int) error
	GetUnusedPreKeyCount(userID string) (int, error)
}

type GroupStore interface {
	CreateGroup(groupID string, creatorID string) error
	AddGroupMember(groupID, userID string) error
	RemoveGroupMember(groupID, userID string) error
	GetGroupMembers(groupID string) ([]string, error)
	
	SaveSenderKey(key models.SenderKey) error
	GetGroupSenderKeys(groupID string) ([]models.SenderKey, error)
	IncrementKeyVersion(groupID string) error
	
	SaveGroupMessage(msg models.EncryptedGroupMessage) error
	GetGroupMessages(groupID string, limit int) ([]models.EncryptedGroupMessage, error)
}

type Store interface {
	KeyStore
	GroupStore
}