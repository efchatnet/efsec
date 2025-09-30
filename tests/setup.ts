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
      // Use deterministic "random" values for testing
      for (let i = 0; i < array.length; i++) {
        array[i] = (i * 31 + 42) % 256; // Deterministic but varied pattern
      }
      return array;
    },
    randomUUID: () => {
      // Deterministic UUID for testing
      return '12345678-1234-4234-a234-123456789012';
    },
    subtle: {
      digest: async (algorithm: string, data: ArrayBuffer) => {
        // More realistic mock digest using simple hash algorithm
        const view = new Uint8Array(data);
        const hash = new Uint8Array(algorithm === 'SHA-256' ? 32 : 20);
        let h = 0x811c9dc5; // FNV-1a initial hash

        for (let i = 0; i < view.length; i++) {
          h ^= view[i];
          h = (h * 0x01000193) >>> 0; // FNV prime
        }

        // Fill hash array with derived values
        for (let i = 0; i < hash.length; i++) {
          hash[i] = (h >>> (i % 4 * 8)) & 0xff;
          h = (h * 31 + i) >>> 0;
        }

        return hash.buffer;
      },

      importKey: async (format: string, keyData: unknown, algorithm: unknown) => {
        // Return a proper mock key object
        return {
          type: 'secret',
          algorithm: algorithm as CryptoAlgorithm,
          extractable: false,
          usages: ['encrypt', 'decrypt', 'sign', 'verify'] as KeyUsage[],
          _keyData: keyData, // Store for testing
        };
      },

      sign: async (_algorithm: unknown, _key: unknown, data: ArrayBuffer) => {
        // Mock signature using hash of data
        const view = new Uint8Array(data);
        const signature = new Uint8Array(64); // Ed25519 signature size

        let seed = 0x12345678;
        for (let i = 0; i < view.length; i++) {
          seed = (seed * 31 + view[i]) >>> 0;
        }

        for (let i = 0; i < signature.length; i++) {
          signature[i] = (seed >>> (i % 4 * 8)) & 0xff;
          seed = (seed * 31 + i) >>> 0;
        }

        return signature.buffer;
      },

      verify: async (_algorithm: unknown, _key: unknown, signature: ArrayBuffer, data: ArrayBuffer) => {
        // Mock verification - always return true for valid test signatures
        const sigView = new Uint8Array(signature);
        const dataView = new Uint8Array(data);

        // Simple check: signature should be deterministic based on data
        let expectedFirst = 0x12345678;
        for (let i = 0; i < dataView.length; i++) {
          expectedFirst = (expectedFirst * 31 + dataView[i]) >>> 0;
        }

        return sigView[0] === ((expectedFirst >>> 24) & 0xff);
      },

      encrypt: async (algorithm: any, _key: unknown, data: ArrayBuffer) => {
        // Mock AES-GCM encryption that's deterministic for testing
        const input = new Uint8Array(data);
        const output = new Uint8Array(input.length + 16); // +16 for GCM tag

        // Simple transformation that's reversible
        const iv = algorithm.iv ? new Uint8Array(algorithm.iv) : new Uint8Array(12);
        for (let i = 0; i < input.length; i++) {
          output[i] = input[i] ^ iv[i % iv.length] ^ 0x55;
        }

        // Add mock authentication tag
        for (let i = input.length; i < output.length; i++) {
          output[i] = (i * 17 + 0xaa) & 0xff;
        }

        return output.buffer;
      },

      decrypt: async (algorithm: any, _key: unknown, data: ArrayBuffer) => {
        // Mock AES-GCM decryption (reverse of encrypt)
        const input = new Uint8Array(data);
        const cipherLength = input.length - 16; // Remove GCM tag

        if (cipherLength < 0) {
          throw new Error('Invalid ciphertext length');
        }

        const output = new Uint8Array(cipherLength);
        const iv = algorithm.iv ? new Uint8Array(algorithm.iv) : new Uint8Array(12);

        for (let i = 0; i < cipherLength; i++) {
          output[i] = input[i] ^ iv[i % iv.length] ^ 0x55;
        }

        return output.buffer;
      },

      deriveBits: async (algorithm: any, _key: unknown, length: number) => {
        // Mock HKDF key derivation
        const output = new Uint8Array(length / 8);
        const salt = algorithm.salt ? new Uint8Array(algorithm.salt) : new Uint8Array(32);
        const info = algorithm.info ? new Uint8Array(algorithm.info) : new Uint8Array(0);

        let seed = 0x9e3779b9; // Golden ratio
        for (let i = 0; i < salt.length; i++) {
          seed ^= salt[i] << (i % 4 * 8);
        }
        for (let i = 0; i < info.length; i++) {
          seed ^= info[i] << (i % 4 * 8);
        }

        for (let i = 0; i < output.length; i++) {
          output[i] = (seed >>> (i % 4 * 8)) & 0xff;
          seed = (seed * 0x9e3779b9 + i) >>> 0;
        }

        return output.buffer;
      }
    },
  },
});
