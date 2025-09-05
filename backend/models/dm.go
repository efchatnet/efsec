// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package models

import "time"

// EncryptedDM represents an encrypted direct message
// This includes both regular messages and key distribution messages
type EncryptedDM struct {
	MessageID    string    `json:"message_id" db:"message_id"`
	SenderID     string    `json:"sender_id" db:"sender_id"`
	RecipientID  string    `json:"recipient_id" db:"recipient_id"`
	Ciphertext   []byte    `json:"ciphertext" db:"ciphertext"`
	MessageType  string    `json:"message_type" db:"message_type"` // "message" or "key_distribution"
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	ReadAt       *time.Time `json:"read_at,omitempty" db:"read_at"`
}