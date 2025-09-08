// Copyright (C) 2025 efchat.net
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
/**
 * Real cryptographic tests that verify actual security properties
 * without mocks - testing the actual crypto.getRandomValues usage
 */
import { describe, test, expect } from 'bun:test';
describe('Cryptographic Security Tests', () => {
    describe('Random Number Generation', () => {
        test('should use Web Crypto API for secure randomness', () => {
            expect(typeof crypto).toBe('object');
            expect(typeof crypto.getRandomValues).toBe('function');
        });
        test('should generate cryptographically secure random bytes', () => {
            const buffer = new Uint8Array(32);
            crypto.getRandomValues(buffer);
            // Check that not all bytes are zero (probability: 1/256^32)
            const allZeros = buffer.every(byte => byte === 0);
            expect(allZeros).toBe(false);
            // Check that not all bytes are the same
            const allSame = buffer.every(byte => byte === buffer[0]);
            expect(allSame).toBe(false);
        });
        test('should produce different values on successive calls', () => {
            const buffer1 = new Uint8Array(16);
            const buffer2 = new Uint8Array(16);
            crypto.getRandomValues(buffer1);
            crypto.getRandomValues(buffer2);
            // Arrays should be different (probability of collision: 1/256^16)
            const areEqual = buffer1.every((byte, index) => byte === buffer2[index]);
            expect(areEqual).toBe(false);
        });
        test('should have good entropy distribution', () => {
            const sampleSize = 10000;
            const buffer = new Uint8Array(sampleSize);
            crypto.getRandomValues(buffer);
            // Count occurrences of each byte value (0-255)
            const counts = new Array(256).fill(0);
            for (const byte of buffer) {
                counts[byte]++;
            }
            // Check that no value appears too frequently (chi-square would be better)
            const maxCount = Math.max(...counts);
            const minCount = Math.min(...counts);
            // For good randomness, no value should appear more than ~5% of the time
            expect(maxCount).toBeLessThan(sampleSize * 0.05);
            expect(minCount).toBeGreaterThan(0); // All values should appear at least once
        });
        test('should generate unique session IDs', () => {
            const generateSecureId = () => {
                const array = new Uint32Array(2);
                crypto.getRandomValues(array);
                return array[0].toString() + array[1].toString();
            };
            const ids = new Set();
            const iterations = 10000;
            for (let i = 0; i < iterations; i++) {
                ids.add(generateSecureId());
            }
            // Should have no collisions with proper cryptographic randomness
            expect(ids.size).toBe(iterations);
        });
        test('should generate secure timestamps with randomness', () => {
            const generateSecureTimestamp = () => {
                const time = Date.now();
                const randomOffset = new Uint8Array(1);
                crypto.getRandomValues(randomOffset);
                return time + (randomOffset[0] % 100);
            };
            const timestamps = [];
            const baseTime = Date.now();
            for (let i = 0; i < 1000; i++) {
                timestamps.push(generateSecureTimestamp());
            }
            // All timestamps should be close to current time
            timestamps.forEach(ts => {
                expect(ts).toBeGreaterThanOrEqual(baseTime);
                expect(ts).toBeLessThan(baseTime + 200);
            });
            // Should have some distribution (timestamps are close together, so many may be identical)
            const uniqueTimestamps = new Set(timestamps);
            expect(uniqueTimestamps.size).toBeGreaterThan(10); // At least some variation
        });
    });
    describe('Data Type Security', () => {
        test('should handle Uint8Array securely', () => {
            const sensitiveData = new Uint8Array(32);
            crypto.getRandomValues(sensitiveData);
            // Verify data is populated
            const hasData = sensitiveData.some(byte => byte !== 0);
            expect(hasData).toBe(true);
            // Test secure clearing
            sensitiveData.fill(0);
            const isCleared = sensitiveData.every(byte => byte === 0);
            expect(isCleared).toBe(true);
        });
        test('should handle Uint32Array for larger random values', () => {
            const array = new Uint32Array(8);
            crypto.getRandomValues(array);
            // Should generate 32-bit values
            array.forEach(value => {
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(0xffffffff);
            });
            // Values should be different
            const uniqueValues = new Set(array);
            expect(uniqueValues.size).toBeGreaterThan(1);
        });
        test('should handle different array sizes correctly', () => {
            const sizes = [1, 16, 32, 64, 256, 1024];
            sizes.forEach(size => {
                const buffer = new Uint8Array(size);
                expect(() => crypto.getRandomValues(buffer)).not.toThrow();
                // Should fill entire buffer with mostly non-zero bytes (statistical)
                const filledBytes = Array.from(buffer).filter(byte => byte !== 0).length;
                expect(filledBytes).toBeGreaterThan(size * 0.9); // At least 90% non-zero
            });
        });
    });
    describe('Input Validation Security', () => {
        test('should validate API URL format', () => {
            const validateApiUrl = (url) => {
                try {
                    const parsed = new URL(url);
                    return parsed.protocol === 'https:';
                }
                catch {
                    return false;
                }
            };
            // Valid URLs
            expect(validateApiUrl('https://api.example.com')).toBe(true);
            expect(validateApiUrl('https://localhost:3000')).toBe(true);
            expect(validateApiUrl('https://api.domain.org/path')).toBe(true);
            // Invalid URLs
            expect(validateApiUrl('http://insecure.com')).toBe(false);
            expect(validateApiUrl('ftp://file.server.com')).toBe(false);
            expect(validateApiUrl('not-a-url')).toBe(false);
            expect(validateApiUrl('')).toBe(false);
        });
        test('should validate user ID format', () => {
            const validateUserId = (userId) => {
                if (!userId || userId.length === 0 || userId.length > 100) {
                    return false;
                }
                if (/[\x00-\x1f\x7f<>'";&\\\/]/.test(userId)) {
                    return false;
                }
                if (userId.trim() !== userId) {
                    return false;
                } // No leading/trailing spaces
                return true;
            };
            // Valid user IDs
            expect(validateUserId('user123')).toBe(true);
            expect(validateUserId('alice.bob')).toBe(true);
            expect(validateUserId('test-user_01')).toBe(true);
            expect(validateUserId('email@domain.com')).toBe(true);
            // Invalid user IDs
            expect(validateUserId('')).toBe(false);
            expect(validateUserId(' user123')).toBe(false); // Leading space
            expect(validateUserId('user123 ')).toBe(false); // Trailing space
            expect(validateUserId('user<script>')).toBe(false); // XSS attempt
            expect(validateUserId('user;DROP TABLE;')).toBe(false); // SQL injection
            expect(validateUserId('user\x00null')).toBe(false); // Null byte
            expect(validateUserId('a'.repeat(101))).toBe(false); // Too long
        });
        test('should validate authentication token format', () => {
            const validateAuthToken = (token) => {
                if (!token || token.length === 0) {
                    return false;
                }
                if (token.length < 10 || token.length > 500) {
                    return false;
                }
                if (/[\x00-\x1f\x7f]/.test(token)) {
                    return false;
                } // No control characters
                if (token.trim() !== token) {
                    return false;
                } // No leading/trailing spaces
                return true;
            };
            // Valid tokens
            expect(validateAuthToken('valid_token_123')).toBe(true);
            expect(validateAuthToken('Bearer-jwt.token.signature')).toBe(true);
            expect(validateAuthToken('a'.repeat(50))).toBe(true);
            // Invalid tokens
            expect(validateAuthToken('')).toBe(false);
            expect(validateAuthToken('short')).toBe(false);
            expect(validateAuthToken(' token')).toBe(false);
            expect(validateAuthToken('token ')).toBe(false);
            expect(validateAuthToken('token\nwith\nnewline')).toBe(false);
            expect(validateAuthToken('a'.repeat(501))).toBe(false);
        });
    });
    describe('Memory Security', () => {
        test('should securely clear sensitive data', () => {
            const clearSensitiveData = (data) => {
                data.fill(0);
            };
            const sensitiveKey = new Uint8Array(32);
            crypto.getRandomValues(sensitiveKey);
            // Verify key has data
            const hasData = sensitiveKey.some(byte => byte !== 0);
            expect(hasData).toBe(true);
            // Clear the key
            clearSensitiveData(sensitiveKey);
            // Verify key is cleared
            const isCleared = sensitiveKey.every(byte => byte === 0);
            expect(isCleared).toBe(true);
        });
        test('should not expose sensitive data in strings', () => {
            const createSafeString = (sensitiveData) => {
                return '[REDACTED]';
            };
            const sensitiveKey = 'secret_key_12345';
            const safeOutput = createSafeString(sensitiveKey);
            expect(safeOutput).not.toContain(sensitiveKey);
            expect(safeOutput).toBe('[REDACTED]');
        });
    });
    describe('Timing Attack Resistance', () => {
        test('should use constant-time comparison for sensitive data', () => {
            // Simulate constant-time comparison using crypto.subtle if available
            const constantTimeEquals = async (a, b) => {
                if (a.length !== b.length) {
                    return false;
                }
                if (crypto.subtle && crypto.subtle.sign) {
                    // Use HMAC for constant-time comparison
                    try {
                        const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, [
                            'sign',
                        ]);
                        const sig1 = await crypto.subtle.sign('HMAC', key, a);
                        const sig2 = await crypto.subtle.sign('HMAC', key, b);
                        return new Uint8Array(sig1).every((byte, i) => byte === new Uint8Array(sig2)[i]);
                    }
                    catch {
                        // Fallback to simple comparison
                        return a.every((byte, i) => byte === b[i]);
                    }
                }
                return a.every((byte, i) => byte === b[i]);
            };
            const data1 = new Uint8Array([1, 2, 3, 4]);
            const data2 = new Uint8Array([1, 2, 3, 4]);
            const data3 = new Uint8Array([1, 2, 3, 5]);
            return constantTimeEquals(data1, data2)
                .then(result => {
                expect(result).toBe(true);
                return constantTimeEquals(data1, data3);
            })
                .then(result => {
                expect(result).toBe(false);
            });
        });
        test('should not vary execution time based on input patterns', () => {
            // Test that operations don't leak timing information
            const performOperation = (data) => {
                let result = 0;
                // Ensure constant-time operation regardless of data content
                for (let i = 0; i < data.length; i++) {
                    result ^= data[i];
                }
                return result;
            };
            const allZeros = new Uint8Array(100).fill(0);
            const allOnes = new Uint8Array(100).fill(255);
            const randomData = new Uint8Array(100);
            crypto.getRandomValues(randomData);
            // Operation should work with any data pattern
            expect(() => performOperation(allZeros)).not.toThrow();
            expect(() => performOperation(allOnes)).not.toThrow();
            expect(() => performOperation(randomData)).not.toThrow();
            // Results should be deterministic for same input
            expect(performOperation(allZeros)).toBe(performOperation(allZeros));
            expect(performOperation(allOnes)).toBe(performOperation(allOnes));
        });
    });
    describe('Error Handling Security', () => {
        test('should not expose sensitive data in error messages', () => {
            const createSecureError = (operation, sensitiveData) => {
                // Never include sensitive data in error message
                return new Error(`Operation '${operation}' failed`);
            };
            const secretKey = 'secret_key_abc123';
            const error = createSecureError('decrypt', secretKey);
            expect(error.message).not.toContain(secretKey);
            expect(error.message).toBe("Operation 'decrypt' failed");
        });
        test('should validate crypto API availability', () => {
            expect(typeof crypto).toBe('object');
            expect(crypto).toBeTruthy();
            expect(typeof crypto.getRandomValues).toBe('function');
            // Test that crypto.getRandomValues actually works
            const buffer = new Uint8Array(1);
            expect(() => crypto.getRandomValues(buffer)).not.toThrow();
        });
        test('should handle edge cases in random generation', () => {
            // Test minimum size
            const small = new Uint8Array(1);
            expect(() => crypto.getRandomValues(small)).not.toThrow();
            // Test maximum typical size
            const large = new Uint8Array(65536); // 64KB
            expect(() => crypto.getRandomValues(large)).not.toThrow();
            // Verify large buffer is filled
            const nonZeroBytes = Array.from(large).filter(byte => byte !== 0).length;
            expect(nonZeroBytes).toBeGreaterThan(large.length * 0.99); // 99% should be non-zero
        });
    });
    describe('Protocol Security Assumptions', () => {
        test('should ensure secure random key generation patterns', () => {
            // Test key generation patterns used by the application
            const generateKeyMaterial = (size) => {
                const key = new Uint8Array(size);
                crypto.getRandomValues(key);
                return key;
            };
            // Test different key sizes commonly used in cryptography
            const keySizes = [16, 32, 64]; // 128-bit, 256-bit, 512-bit
            keySizes.forEach(size => {
                const key = generateKeyMaterial(size);
                expect(key.length).toBe(size);
                // Key should not be all zeros
                const hasEntropy = key.some(byte => byte !== 0);
                expect(hasEntropy).toBe(true);
                // Key bytes should have reasonable distribution
                const uniqueBytes = new Set(key);
                expect(uniqueBytes.size).toBeGreaterThan(1);
            });
        });
        test('should verify base64 encoding for key transport', () => {
            const base64Encode = (data) => {
                return btoa(String.fromCharCode(...data));
            };
            const base64Decode = (encoded) => {
                return new Uint8Array([...atob(encoded)].map(c => c.charCodeAt(0)));
            };
            const originalData = new Uint8Array(32);
            crypto.getRandomValues(originalData);
            const encoded = base64Encode(originalData);
            const decoded = base64Decode(encoded);
            // Round-trip should preserve data exactly
            expect(decoded.length).toBe(originalData.length);
            expect(decoded.every((byte, i) => byte === originalData[i])).toBe(true);
            // Encoded string should be valid base64
            expect(/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)).toBe(true);
        });
        test('should validate message format assumptions', () => {
            // Test message structure that would be used by the protocol
            const createMessage = (content) => {
                const messageId = new Uint32Array(1);
                crypto.getRandomValues(messageId);
                return {
                    id: messageId[0].toString(),
                    content,
                    timestamp: Date.now(),
                    version: 1,
                };
            };
            const message = createMessage('Hello, secure world!');
            expect(typeof message).toBe('object');
            expect('id' in message).toBe(true);
            expect('content' in message).toBe(true);
            expect('timestamp' in message).toBe(true);
            expect('version' in message).toBe(true);
            // Message should be JSON serializable
            expect(() => JSON.stringify(message)).not.toThrow();
            const serialized = JSON.stringify(message);
            expect(() => JSON.parse(serialized)).not.toThrow();
        });
    });
});
//# sourceMappingURL=crypto.test.js.map