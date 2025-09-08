// Copyright (C) 2025 efchat.net
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Type definitions for bun:test module
 */

declare module 'bun:test' {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect<T>(actual: T): {
    toBe(expected: T): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeNull(): void;
    toBeNaN(): void;
    toBeInstanceOf(constructor: new (...args: any[]) => any): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toContain(expected: unknown): void;
    toMatch(expected: RegExp | string): void;
    toThrow(expected?: string | RegExp): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toEqual(expected: T): void;
    toStrictEqual(expected: T): void;
    toHaveLength(expected: number): void;
    toHaveProperty(property: string, value?: any): void;
    not: {
      toBe(expected: T): void;
      toBeDefined(): void;
      toBeUndefined(): void;
      toBeNull(): void;
      toBeNaN(): void;
      toBeInstanceOf(constructor: new (...args: any[]) => any): void;
      toBeGreaterThan(expected: number): void;
      toBeGreaterThanOrEqual(expected: number): void;
      toBeLessThan(expected: number): void;
      toBeLessThanOrEqual(expected: number): void;
      toContain(expected: unknown): void;
      toMatch(expected: RegExp | string): void;
      toThrow(expected?: string | RegExp): void;
      toBeTruthy(): void;
      toBeFalsy(): void;
      toEqual(expected: T): void;
      toStrictEqual(expected: T): void;
      toHaveLength(expected: number): void;
      toHaveProperty(property: string, value?: any): void;
    };
    rejects: {
      toBe(expected: T): Promise<void>;
      toBeDefined(): Promise<void>;
      toBeUndefined(): Promise<void>;
      toBeNull(): Promise<void>;
      toBeNaN(): Promise<void>;
      toBeInstanceOf(constructor: new (...args: any[]) => any): Promise<void>;
      toBeGreaterThan(expected: number): Promise<void>;
      toBeGreaterThanOrEqual(expected: number): Promise<void>;
      toBeLessThan(expected: number): Promise<void>;
      toBeLessThanOrEqual(expected: number): Promise<void>;
      toContain(expected: unknown): Promise<void>;
      toMatch(expected: RegExp | string): Promise<void>;
      toThrow(expected?: string | RegExp): Promise<void>;
      toBeTruthy(): Promise<void>;
      toBeFalsy(): Promise<void>;
      toEqual(expected: T): Promise<void>;
      toStrictEqual(expected: T): Promise<void>;
      toHaveLength(expected: number): Promise<void>;
      toHaveProperty(property: string, value?: any): Promise<void>;
      not: {
        toBe(expected: T): Promise<void>;
        toBeDefined(): Promise<void>;
        toBeUndefined(): Promise<void>;
        toBeNull(): Promise<void>;
        toBeNaN(): Promise<void>;
        toBeInstanceOf(constructor: new (...args: any[]) => any): Promise<void>;
        toBeGreaterThan(expected: number): Promise<void>;
        toBeGreaterThanOrEqual(expected: number): Promise<void>;
        toBeLessThan(expected: number): Promise<void>;
        toBeLessThanOrEqual(expected: number): Promise<void>;
        toContain(expected: unknown): Promise<void>;
        toMatch(expected: RegExp | string): Promise<void>;
        toThrow(expected?: string | RegExp): Promise<void>;
        toBeTruthy(): Promise<void>;
        toBeFalsy(): Promise<void>;
        toEqual(expected: T): Promise<void>;
        toStrictEqual(expected: T): Promise<void>;
        toHaveLength(expected: number): Promise<void>;
        toHaveProperty(property: string, value?: any): Promise<void>;
      };
    };
  };
  export function beforeEach(fn: () => void): void;
}
