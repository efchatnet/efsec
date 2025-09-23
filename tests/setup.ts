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

import 'fake-indexeddb/auto';

Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: (array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
    subtle: {
      digest: async (_algorithm: string, data: ArrayBuffer) => {
        // Simple mock digest that returns deterministic hash
        const view = new Uint8Array(data);
        const hash = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          hash[i] = (view[i % view.length] + i) % 256;
        }
        return hash.buffer;
      },
      importKey: async () => ({ type: 'secret', algorithm: { name: 'AES-GCM' } }),
      sign: async () => new ArrayBuffer(32),
      encrypt: async (_algorithm: unknown, _key: unknown, data: ArrayBuffer) => {
        // Mock encryption that returns modified data
        const input = new Uint8Array(data);
        const output = new Uint8Array(input.length);
        for (let i = 0; i < input.length; i++) {
          output[i] = input[i] ^ 0xaa; // Simple XOR encryption
        }
        return output.buffer;
      },
      decrypt: async (_algorithm: unknown, _key: unknown, data: ArrayBuffer) => {
        // Mock decryption that reverses the XOR
        const input = new Uint8Array(data);
        const output = new Uint8Array(input.length);
        for (let i = 0; i < input.length; i++) {
          output[i] = input[i] ^ 0xaa; // Reverse XOR
        }
        return output.buffer;
      },
    },
  },
});
