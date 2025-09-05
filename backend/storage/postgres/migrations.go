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

package postgres

func (s *Store) Migrate() error {
	migrations := []string{
		// Identity keys table
		`CREATE TABLE IF NOT EXISTS identity_keys (
			user_id VARCHAR(255) PRIMARY KEY,
			public_key BYTEA NOT NULL,
			registration_id INTEGER NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,

		// Signed prekeys table
		`CREATE TABLE IF NOT EXISTS signed_pre_keys (
			user_id VARCHAR(255) NOT NULL,
			key_id INTEGER NOT NULL,
			public_key BYTEA NOT NULL,
			signature BYTEA NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (user_id, key_id)
		)`,

		// One-time prekeys table
		`CREATE TABLE IF NOT EXISTS one_time_pre_keys (
			user_id VARCHAR(255) NOT NULL,
			key_id INTEGER NOT NULL,
			public_key BYTEA NOT NULL,
			used BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (user_id, key_id)
		)`,

		// Create index for finding unused prekeys
		`CREATE INDEX IF NOT EXISTS idx_unused_prekeys 
		ON one_time_pre_keys(user_id, used) 
		WHERE used = FALSE`,

		// Groups table
		`CREATE TABLE IF NOT EXISTS groups (
			group_id VARCHAR(255) PRIMARY KEY,
			created_by VARCHAR(255) NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,

		// Group members table
		`CREATE TABLE IF NOT EXISTS group_members (
			group_id VARCHAR(255) NOT NULL,
			user_id VARCHAR(255) NOT NULL,
			joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			sender_key_version INTEGER NOT NULL DEFAULT 1,
			PRIMARY KEY (group_id, user_id),
			FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE
		)`,

		// Sender keys table
		`CREATE TABLE IF NOT EXISTS sender_keys (
			group_id VARCHAR(255) NOT NULL,
			user_id VARCHAR(255) NOT NULL,
			chain_key BYTEA NOT NULL,
			public_signature_key BYTEA NOT NULL,
			key_version INTEGER NOT NULL DEFAULT 1,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (group_id, user_id),
			FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE
		)`,

		// Encrypted group messages table
		`CREATE TABLE IF NOT EXISTS encrypted_group_messages (
			message_id VARCHAR(255) PRIMARY KEY,
			group_id VARCHAR(255) NOT NULL,
			sender_id VARCHAR(255) NOT NULL,
			ciphertext BYTEA NOT NULL,
			signature BYTEA NOT NULL,
			key_version INTEGER NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE
		)`,

		// Create index for message retrieval
		`CREATE INDEX IF NOT EXISTS idx_group_messages 
		ON encrypted_group_messages(group_id, created_at DESC)`,

		// Encrypted DM messages table
		`CREATE TABLE IF NOT EXISTS encrypted_dm_messages (
			message_id VARCHAR(255) PRIMARY KEY,
			sender_id VARCHAR(255) NOT NULL,
			recipient_id VARCHAR(255) NOT NULL,
			ciphertext BYTEA NOT NULL,
			message_type INTEGER NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,

		// Create index for DM retrieval
		`CREATE INDEX IF NOT EXISTS idx_dm_messages 
		ON encrypted_dm_messages(sender_id, recipient_id, created_at DESC)`,

		// Session state table (for tracking active sessions)
		`CREATE TABLE IF NOT EXISTS sessions (
			user_id VARCHAR(255) NOT NULL,
			peer_id VARCHAR(255) NOT NULL,
			established_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			last_used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (user_id, peer_id)
		)`,
	}

	for _, migration := range migrations {
		if _, err := s.db.Exec(migration); err != nil {
			return err
		}
	}

	return nil
}