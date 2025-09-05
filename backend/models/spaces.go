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

// E2ESpace represents an E2E encrypted space (DM or group)
type E2ESpace struct {
	SpaceID      string    `json:"space_id"`
	SpaceType    string    `json:"space_type"` // "dm" or "group"
	IsE2EEnabled bool      `json:"is_e2e_enabled"`
	CreatedBy    string    `json:"created_by"`
	CreatedAt    time.Time `json:"created_at"`
	MemberCount  int       `json:"member_count"`
}

// DMSpace represents a direct message space between two users
type DMSpace struct {
	SpaceID       string     `json:"space_id"`
	User1ID       string     `json:"user1_id"`
	User2ID       string     `json:"user2_id"`
	IsE2EEnabled  bool       `json:"is_e2e_enabled"`
	CreatedAt     time.Time  `json:"created_at"`
	LastMessageAt *time.Time `json:"last_message_at,omitempty"`
}

// E2ESpaceMember represents a member of an E2E space
type E2ESpaceMember struct {
	SpaceID           string    `json:"space_id"`
	UserID            string    `json:"user_id"`
	JoinedAt          time.Time `json:"joined_at"`
	SessionEstablished bool      `json:"session_established"`
}