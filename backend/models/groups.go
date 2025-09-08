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

package models

import (
	"time"
)

// SenderKey stores ONLY public information - chain keys remain on client!
type SenderKey struct {
	GroupID           string    `json:"group_id" db:"group_id"`
	UserID            string    `json:"user_id" db:"user_id"`
	PublicSignatureKey []byte   `json:"public_signature_key" db:"public_signature_key"`
	KeyVersion        int       `json:"key_version" db:"key_version"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
}

type GroupMember struct {
	GroupID        string    `json:"group_id" db:"group_id"`
	UserID         string    `json:"user_id" db:"user_id"`
	JoinedAt       time.Time `json:"joined_at" db:"joined_at"`
	SenderKeyVersion int     `json:"sender_key_version" db:"sender_key_version"`
}

type EncryptedGroupMessage struct {
	MessageID  string    `json:"message_id" db:"message_id"`
	GroupID    string    `json:"group_id" db:"group_id"`
	SenderID   string    `json:"sender_id" db:"sender_id"`
	Ciphertext []byte    `json:"ciphertext" db:"ciphertext"`
	Signature  []byte    `json:"signature" db:"signature"`
	KeyVersion int       `json:"key_version" db:"key_version"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type GroupKeyBundle struct {
	GroupID     string      `json:"group_id"`
	Members     []string    `json:"members"`
	SenderKeys  []SenderKey `json:"sender_keys"`
	KeyVersion  int         `json:"key_version"`
}