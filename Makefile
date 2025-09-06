# Copyright (C) 2025 efchat.net
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

.PHONY: build-all build-wasm build-client test-all test-wasm test-client clean install deps-rust deps-node verify

# Default target
all: build-all

# Verify vodozemac authenticity before building
verify:
	@echo "Verifying vodozemac source authenticity..."
	@cd vodozemac && git remote -v | grep -q "github.com/matrix-org/vodozemac" || (echo "ERROR: vodozemac must be from official Matrix repository" && exit 1)
	@echo "✓ vodozemac source verified"

# Install all dependencies
install: deps-rust deps-node
	@echo "All EfSec dependencies installed"

# Install Rust dependencies and wasm-pack
deps-rust:
	@echo "Setting up Rust WASM toolchain..."
	@command -v rustc >/dev/null 2>&1 || (echo "Installing Rust..." && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y)
	@source ${HOME}/.cargo/env || true
	@command -v wasm-pack >/dev/null 2>&1 || (echo "Installing wasm-pack..." && curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh)
	@rustc --version
	@wasm-pack --version

# Install Node.js dependencies
deps-node:
	@echo "Installing TypeScript client dependencies..."
	@cd client && npm install

# Build everything (WASM + TypeScript)
build-all: verify build-wasm build-client
	@echo "EfSec E2E encryption library build complete"
	@echo "✓ WASM binaries ready in efsec-wasm/pkg/"
	@echo "✓ TypeScript client ready in client/dist/"

# Build Rust to WebAssembly
build-wasm:
	@echo "Building vodozemac (Rust) to WebAssembly..."
	@source ${HOME}/.cargo/env || true
	@cd efsec-wasm && wasm-pack build --target web --out-dir pkg
	@echo "WASM build complete"
	@ls -la efsec-wasm/pkg/

# Build TypeScript client
build-client:
	@echo "Building TypeScript client..."
	@cd client && npm run build
	@echo "TypeScript client build complete"
	@ls -la client/dist/

# Test everything
test-all: test-wasm test-client
	@echo "All EfSec tests completed"

# Test WASM module
test-wasm:
	@echo "Testing WASM module..."
	@cd efsec-wasm && wasm-pack test --headless --firefox

# Test TypeScript client
test-client:
	@echo "Testing TypeScript client..."
	@cd client && npm test

# Clean build artifacts
clean:
	@echo "Cleaning EfSec build artifacts..."
	@rm -rf efsec-wasm/pkg
	@rm -rf client/dist
	@rm -rf client/node_modules/.cache
	@echo "Clean complete"

# Railway deployment helpers
railway-build: build-all
	@echo "Railway build complete - EfSec library ready"

# Publish to npm (for CI/CD)
publish:
	@echo "Publishing EfSec to npm..."
	@cd client && npm publish
	@echo "EfSec published to @efchatnet/efsec"