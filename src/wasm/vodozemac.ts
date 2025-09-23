/**
 * Copyright (C) 2024 William Theesfeld <william@theesfeld.net>
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

let wasmModule: any = null;
let isInitialized = false;

export async function initializeWasm(): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    wasmModule = {
      Account: {
        new: () => ({
          identity_keys: () => ({
            curve25519: 'mock_curve25519_key',
            ed25519: 'mock_ed25519_key',
          }),
          generate_one_time_keys: (count: number) => {
            const keys = [];
            for (let i = 0; i < count; i++) {
              keys.push(`mock_otk_${i}`);
            }
            return keys;
          },
          create_outbound_session: () => ({
            session_id: () => 'mock_session_id',
            encrypt: (plaintext: string) => ({
              message_type: 1,
              ciphertext: btoa(plaintext),
            }),
          }),
          create_inbound_session: () => ({
            session_id: () => 'mock_session_id',
            decrypt: (ciphertext: string) => atob(ciphertext),
          }),
        }),
      },
      Session: {
        from_libolm_pickle: () => null,
      },
    };

    isInitialized = true;
    console.log('[EfSec] WASM initialized (mock implementation)');
  } catch (error) {
    console.error('[EfSec] Failed to initialize WASM:', error);
    throw new Error(`WASM initialization failed: ${error}`);
  }
}

export function getWasmModule() {
  if (!isInitialized || !wasmModule) {
    throw new Error('WASM not initialized. Call initializeWasm() first.');
  }
  return wasmModule;
}