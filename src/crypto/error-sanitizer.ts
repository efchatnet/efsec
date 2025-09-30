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

/**
 * Sanitizes error messages to prevent information disclosure
 * while maintaining useful debugging information
 */
export class ErrorSanitizer {
  private static readonly SENSITIVE_PATTERNS = [
    /private[_-]?key/gi,
    /secret[_-]?key/gi,
    /session[_-]?key/gi,
    /password/gi,
    /token/gi,
    /credential/gi,
    /auth[_-]?token/gi,
    /access[_-]?token/gi,
    /refresh[_-]?token/gi,
    /api[_-]?key/gi,
    /signature/gi,
    /nonce/gi,
    /iv/gi,
    /salt/gi,
    /hash/gi,
    /digest/gi,
  ];

  private static readonly SENSITIVE_VALUES = [
    /^[A-Za-z0-9+/]{20,}={0,2}$/, // Base64-like strings
    /^[0-9a-f]{32,}$/i, // Hex strings (likely keys/hashes)
    /^[A-Za-z0-9_-]{20,}$/, // Long alphanumeric strings
  ];

  /**
   * Sanitizes an error message by removing or masking sensitive information
   */
  static sanitizeError(error: unknown): string {
    let errorMessage = '';

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else {
      errorMessage = String(error);
    }

    // Remove sensitive patterns
    for (const pattern of this.SENSITIVE_PATTERNS) {
      errorMessage = errorMessage.replace(pattern, '[REDACTED]');
    }

    // Mask sensitive values
    for (const pattern of this.SENSITIVE_VALUES) {
      errorMessage = errorMessage.replace(pattern, '[REDACTED]');
    }

    // Remove stack traces that might contain sensitive information
    errorMessage = errorMessage.split('\n')[0];

    // Truncate very long error messages
    if (errorMessage.length > 200) {
      errorMessage = errorMessage.substring(0, 200) + '...';
    }

    return errorMessage;
  }

  /**
   * Creates a safe error object for logging
   */
  static createSafeError(originalError: unknown, context?: string): Error {
    const sanitizedMessage = this.sanitizeError(originalError);
    const contextMessage = context ? `[${context}] ` : '';
    
    return new Error(`${contextMessage}${sanitizedMessage}`);
  }

  /**
   * Logs an error safely without exposing sensitive information
   */
  static logError(error: unknown, context?: string): void {
    const safeError = this.createSafeError(error, context);
    console.error(safeError.message);
  }

  /**
   * Validates that an error message doesn't contain sensitive information
   */
  static isErrorSafe(errorMessage: string): boolean {
    for (const pattern of this.SENSITIVE_PATTERNS) {
      if (pattern.test(errorMessage)) {
        return false;
      }
    }

    for (const pattern of this.SENSITIVE_VALUES) {
      if (pattern.test(errorMessage)) {
        return false;
      }
    }

    return true;
  }
}