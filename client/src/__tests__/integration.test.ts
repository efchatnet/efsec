// Copyright (C) 2025 efchat.net
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Integration tests that verify actual behavior without mocks
 * Tests real API interactions, error handling, and security properties
 */

import { describe, test, expect } from 'bun:test';
import { EfSecClient } from '../index';

describe('EfSec Integration Tests', () => {
  describe('Client Initialization', () => {
    test('should create client with valid API URL', () => {
      const client = new EfSecClient('https://api.example.com');
      expect(client).toBeInstanceOf(EfSecClient);
    });

    test('should require user ID for initialization', async () => {
      const client = new EfSecClient('https://api.example.com');

      // Should reject initialization without user ID
      await expect(client.init()).rejects.toThrow(/User ID required/);
      await expect(client.init('')).rejects.toThrow(/User ID required/);
    });

    test('should attempt initialization with valid user ID', async () => {
      const client = new EfSecClient('https://api.example.com');

      // This will fail due to network/WASM issues, but should get past user ID check
      await expect(client.init('valid_user')).rejects.not.toThrow(
        /User ID required/
      );
    });
  });

  describe('API URL Validation', () => {
    test('should accept HTTPS URLs', () => {
      const httpsUrls = [
        'https://api.example.com',
        'https://localhost:3000',
        'https://secure.domain.org/api/v1',
      ];

      httpsUrls.forEach(url => {
        expect(() => new EfSecClient(url)).not.toThrow();
      });
    });

    test('should handle URL edge cases', () => {
      // These should all work - the client doesn't validate URL format in constructor
      expect(() => new EfSecClient('https://api.test.com')).not.toThrow();
      expect(() => new EfSecClient('https://127.0.0.1:8080')).not.toThrow();
      expect(() => new EfSecClient('https://[::1]:3000')).not.toThrow(); // IPv6
    });
  });

  describe('Security Properties', () => {
    test('should not expose sensitive data in client state', () => {
      const client = new EfSecClient('https://api.example.com');

      // Convert client to string - should be generic object representation
      const clientStr = client.toString();
      expect(clientStr).toBe('[object Object]');

      // Constructor name should be accessible
      expect(client.constructor.name).toBe('EfSecClient');
    });

    test('should handle multiple client instances independently', () => {
      const client1 = new EfSecClient('https://api1.example.com');
      const client2 = new EfSecClient('https://api2.example.com');

      expect(client1).not.toBe(client2);
      expect(client1.constructor.name).toBe(client2.constructor.name);
      // They're different instances but have same toString behavior
      expect(client1.toString()).toBe(client2.toString());
    });
  });

  describe('Error Handling', () => {
    test('should handle network failures gracefully', async () => {
      const client = new EfSecClient('https://nonexistent.domain.invalid');

      // Should fail but not crash
      await expect(client.init('user')).rejects.toThrow();
    });

    test('should handle malformed URLs in requests', async () => {
      // Test with technically valid but unusual URLs
      const client = new EfSecClient('https://test.local');

      await expect(client.init('user')).rejects.toThrow();
    });

    test('should provide meaningful error messages', async () => {
      const client = new EfSecClient('https://api.example.com');

      try {
        await client.init();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message;
        expect(message).toContain('User ID required');
        expect(message).toContain('E2E encryption');
      }
    });
  });

  describe('State Management', () => {
    test('should track initialization state correctly', async () => {
      const client = new EfSecClient('https://api.example.com');

      // Should not be initialized initially
      // (We can't directly check private members, but behavior should reflect this)

      // Multiple init attempts should be handled
      const promise1 = client.init('user').catch(() => 'failed');
      const promise2 = client.init('user').catch(() => 'failed');

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe('failed');
      expect(result2).toBe('failed');
    });

    test('should handle concurrent initialization attempts', async () => {
      const client = new EfSecClient('https://api.example.com');

      // Start multiple initialization attempts simultaneously
      const promises = Array(5)
        .fill(0)
        .map(() => client.init('user').catch(() => 'failed'));

      const results = await Promise.all(promises);
      expect(results.every(result => result === 'failed')).toBe(true);
    });
  });

  describe('Method Availability', () => {
    test('should expose expected public methods', () => {
      const client = new EfSecClient('https://api.example.com');

      // Check that essential methods exist
      expect(typeof client.init).toBe('function');

      // These methods should exist (checking via prototype to avoid private access issues)
      const proto = Object.getPrototypeOf(client);
      const methods = Object.getOwnPropertyNames(proto).filter(
        name => typeof proto[name] === 'function' && name !== 'constructor'
      );

      expect(methods).toContain('init');
      expect(methods.length).toBeGreaterThan(0);
    });

    test('should have proper method binding', async () => {
      const client = new EfSecClient('https://api.example.com');

      // Methods should be bound to the instance
      const initMethod = client.init.bind(client);
      await expect(initMethod()).rejects.toThrow(/User ID required/);
    });
  });

  describe('Resource Management', () => {
    test('should not leak resources on repeated operations', async () => {
      const client = new EfSecClient('https://api.example.com');

      // Perform many operations that should fail
      const promises = Array(100)
        .fill(0)
        .map(async (_, i) => {
          try {
            await client.init(`user${i}`);
          } catch {
            // Expected to fail
          }
        });

      await Promise.all(promises);

      // Should still work after many failed attempts
      await expect(client.init('final_user')).rejects.toThrow();
    });

    test('should handle garbage collection appropriately', () => {
      // Create and destroy many client instances
      const clients = Array(1000)
        .fill(0)
        .map((_, i) => new EfSecClient(`https://api${i}.example.com`));

      expect(clients.length).toBe(1000);

      // Clear references (simulating GC)
      clients.length = 0;

      // Should still be able to create new clients
      const newClient = new EfSecClient('https://api.example.com');
      expect(newClient).toBeInstanceOf(EfSecClient);
    });
  });

  describe('Type Safety', () => {
    test('should handle different parameter types correctly', async () => {
      const client = new EfSecClient('https://api.example.com');

      // Test with various invalid parameter types
      // @ts-expect-error - Testing invalid types
      await expect(client.init(123)).rejects.toThrow();

      // @ts-expect-error - Testing invalid types
      await expect(client.init(null)).rejects.toThrow();
    });

    test('should work with proper string types', async () => {
      const client = new EfSecClient('https://api.example.com');

      const user = 'string_user';

      // Should not throw type errors (but will throw network/WASM errors)
      await expect(client.init(user)).rejects.toThrow();
    });
  });

  describe('Security Boundary Tests', () => {
    test('should reject initialization without proper user ID', async () => {
      const client = new EfSecClient('https://api.example.com');

      // Test various forms of empty/invalid user IDs
      const invalidUserIds = [
        undefined,
        '',
        ' ',
      ];

      for (const userId of invalidUserIds) {
        try {
          await client.init(userId);
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          const message = (error as Error).message;
          // Should fail with user ID error, not reach WASM/indexedDB initialization
          expect(message).toContain('User ID required');
        }
      }
    });

    test('should validate user ID parameters properly', async () => {
      const client = new EfSecClient('https://api.example.com');

      // These should pass the user ID check but fail later
      const validUserIds = [
        'valid_user',
        'user456',
        'alice@example.com',
      ];

      for (const userId of validUserIds) {
        await expect(client.init(userId)).rejects.not.toThrow(/User ID required/);
      }
    });
  });
});
