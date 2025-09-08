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

type IdentityKey struct {
	UserID         string    `json:"user_id" db:"user_id"`
	PublicKey      []byte    `json:"public_key" db:"public_key"`
	RegistrationID int       `json:"registration_id" db:"registration_id"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

type SignedPreKey struct {
	UserID    string    `json:"user_id" db:"user_id"`
	KeyID     int       `json:"key_id" db:"prekey_id"`
	PublicKey []byte    `json:"public_key" db:"public_key"`
	Signature []byte    `json:"signature" db:"signature"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type OneTimePreKey struct {
	UserID    string    `json:"user_id" db:"user_id"`
	KeyID     int       `json:"key_id" db:"prekey_id"`
	PublicKey []byte    `json:"public_key" db:"public_key"`
	Used      bool      `json:"used" db:"used"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type KyberPreKey struct {
	UserID    string    `json:"user_id" db:"user_id"`
	KeyID     int       `json:"key_id" db:"key_id"`
	PublicKey []byte    `json:"public_key" db:"public_key"`
	Signature []byte    `json:"signature" db:"signature"`
	Used      bool      `json:"used" db:"used"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type PreKeyBundle struct {
	RegistrationID     int            `json:"registration_id"`
	IdentityPublicKey  []byte         `json:"identity_public_key"`
	SignedPreKey       SignedPreKey   `json:"signed_pre_key"`
	OneTimePreKey      *OneTimePreKey `json:"one_time_pre_key,omitempty"`
	KyberPreKey        *KyberPreKey   `json:"kyber_pre_key,omitempty"`
}

type KeyRegistration struct {
	RegistrationID    int             `json:"registration_id"`
	IdentityPublicKey []byte          `json:"identity_public_key"`
	SignedPreKey      SignedPreKey    `json:"signed_pre_key"`
	OneTimePreKeys    []OneTimePreKey `json:"one_time_pre_keys"`
	KyberPreKeys      []KyberPreKey   `json:"kyber_pre_keys,omitempty"`
}