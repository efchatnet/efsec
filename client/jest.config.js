// Copyright (C) 2025 efchat.net
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  passWithNoTests: true,
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/src/wasm/',
    '<rootDir>/efsec-wasm/',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/src/wasm/',
    '<rootDir>/efsec-wasm/',
  ],
  haste: {
    enableSymlinks: false,
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/wasm/**',
    '!src/**/*.d.ts',
  ],
};