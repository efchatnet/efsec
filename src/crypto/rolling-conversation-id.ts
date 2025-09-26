/**
 * Copyright (C) 2025 efchat <tj@efchat.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { Session } from './types.js';

export function getRollingConversationId(session: Session, currentUserId: number): string {
  const remoteUserId = Number.parseInt(session.remoteUserId);

  // Normalize user pair: smaller ID first for consistency
  const normalizedUserA = Math.min(currentUserId, remoteUserId);
  const normalizedUserB = Math.max(currentUserId, remoteUserId);
  const userPair = `${normalizedUserA}:${normalizedUserB}`;

  // Get current chain key hash from session state
  const chainKeyHash = hashChainKey(session.state.sendingChain.chainKey);

  // Create rolling conversation ID by combining user pair with chain key state
  const rollingId = hashString(`${userPair}:${chainKeyHash}`);

  return `dm_${rollingId}`;
}

function hashChainKey(chainKey: string): string {
  // Simple hash of chain key - takes first 8 chars for rolling ID derivation
  let hash = 0;
  for (let i = 0; i < Math.min(chainKey.length, 32); i++) {
    const char = chainKey.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).substring(0, 8);
}

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

export function getStableConversationSeed(session: Session, currentUserId: number): string {
  const remoteUserId = Number.parseInt(session.remoteUserId);

  // Create stable seed for conversation mapping (doesn't change)
  const normalizedUserA = Math.min(currentUserId, remoteUserId);
  const normalizedUserB = Math.max(currentUserId, remoteUserId);

  return hashString(`${normalizedUserA}:${normalizedUserB}`);
}
