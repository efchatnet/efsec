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
	
	// Kyber prekey support (post-quantum resistant)
	AddKyberPreKeys(userID string, prekeys []models.KyberPreKey) error
	GetUnusedKyberPreKey(userID string) (*models.KyberPreKey, error)
	MarkKyberPreKeyUsed(userID string, keyID int) error
	GetUnusedKyberPreKeyCount(userID string) (int, error)
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

type SpaceStore interface {
	// DM space management
	CreateDMSpace(spaceID, user1ID, user2ID string, enableE2E bool) error
	FindDMSpace(user1ID, user2ID string) (*models.DMSpace, error)
	GetUserDMSpaces(userID string) ([]models.DMSpace, error)
	
	// E2E space management
	CreateE2EGroupSpace(spaceID, createdBy string, memberIDs []string) error
	GetE2ESpace(spaceID string) (*models.E2ESpace, error)
	EnableE2EForSpace(spaceID string) error
	IsSpaceMember(spaceID, userID string) (bool, error)
	
	// Session management
	SessionExists(userID, peerID string) (bool, error)
}

type DMStore interface {
	SaveDM(dm models.EncryptedDM) error
	GetDMsForUser(userID string, messageType string, limit int) ([]models.EncryptedDM, error)
	GetDMsBetweenUsers(userID1, userID2 string, limit int) ([]models.EncryptedDM, error)
	MarkDMAsRead(messageID, userID string) error
	DeleteDMForUser(messageID, userID string) error
}

type Store interface {
	KeyStore
	GroupStore
	SpaceStore
	DMStore
}