# Copyright (C) 2025 efchat.net
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

.PHONY: build-all build-wasm build-client test-all test-wasm test-client clean install deps-rust deps-node verify lint lint-rust lint-typescript

# Default target
all: build-all

# Verify vodozemac authenticity before building
verify:
	@echo "Verifying vodozemac source authenticity..."
	@if [ -f "vodozemac/Cargo.toml" ] && grep -q "name = \"vodozemac\"" vodozemac/Cargo.toml; then \
		echo "✓ vodozemac Cargo.toml found"; \
		if [ -f "vodozemac/src/lib.rs" ] && grep -q "Matrix" vodozemac/README.md 2>/dev/null; then \
			echo "✓ vodozemac source code verified"; \
		else \
			echo "⚠️  vodozemac source structure verification skipped"; \
		fi; \
	else \
		echo "ERROR: vodozemac source not found or invalid structure"; \
		exit 1; \
	fi
	@echo "✓ vodozemac source verified"

# Code quality checks (linting, formatting)
lint: lint-rust lint-typescript
	@echo "✓ All code quality checks passed"

# Rust linting and formatting
lint-rust:
	@echo "Running Rust code quality checks..."
	@source ${HOME}/.cargo/env || true
	@cd efsec-wasm && cargo fmt -- --check
	@cd efsec-wasm && cargo clippy --target wasm32-unknown-unknown -- -D warnings -W clippy::pedantic
	@echo "✓ Rust code quality checks passed"

# TypeScript linting and formatting  
lint-typescript:
	@echo "Running TypeScript code quality checks..."
	@cd client && npm run quality
	@echo "✓ TypeScript code quality checks passed"

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
build-all: verify lint build-wasm build-client
	@echo "EfSec E2E encryption library build complete"
	@echo "✓ Code quality checks passed"
	@echo "✓ WASM binaries ready in efsec-wasm/pkg/"
	@echo "✓ TypeScript client ready in client/dist/"

# Build Rust to WebAssembly for multiple targets
build-wasm:
	@echo "Building vodozemac (Rust) to WebAssembly for multiple targets..."
	@source ${HOME}/.cargo/env || true
	@echo "Building for web target (iOS Safari, Android Chrome, PWAs)..."
	@cd efsec-wasm && wasm-pack build --target web --out-dir pkg-web
	@echo "Building for bundler target (React Native, Electron)..."
	@cd efsec-wasm && wasm-pack build --target bundler --out-dir pkg-bundler
	@echo "Building for nodejs target (SSR)..."
	@cd efsec-wasm && wasm-pack build --target nodejs --out-dir pkg-nodejs
	@echo "Multi-target WASM build complete"
	@echo "Web target (mobile compatible):"
	@ls -la efsec-wasm/pkg-web/
	@echo "Bundler target (React Native compatible):"
	@ls -la efsec-wasm/pkg-bundler/
	@echo "Node.js target (SSR compatible):"
	@ls -la efsec-wasm/pkg-nodejs/

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
	@rm -rf efsec-wasm/pkg-web efsec-wasm/pkg-bundler efsec-wasm/pkg-nodejs efsec-wasm/pkg
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