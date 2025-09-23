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

import type { EncryptedMessage, PlaintextMessage, Session } from './types.js';
import * as vodozemac from './vodozemac.js';

export async function encryptMessage(
  session: Session,
  message: PlaintextMessage
): Promise<EncryptedMessage> {
  if (!vodozemac.isInitialized()) {
    throw new Error('Vodozemac not initialized - call initialize() first');
  }

  return await vodozemac.encrypt(session, message);
}

export async function decryptMessage(
  session: Session,
  encryptedMessage: EncryptedMessage
): Promise<PlaintextMessage> {
  if (!vodozemac.isInitialized()) {
    throw new Error('Vodozemac not initialized - call initialize() first');
  }

  return await vodozemac.decrypt(session, encryptedMessage);
}
