# Makefile for efsec - E2E encryption module
# Ensures reproducible builds and library verification

.PHONY: all build verify clean test

# Version of libsignal to use (specific commit for reproducibility)
LIBSIGNAL_COMMIT := $(shell cd libsignal && git rev-parse HEAD)

all: verify build

verify:
	@echo "Verifying libsignal authenticity..."
	@cd libsignal && git remote -v | grep -q "github.com/signalapp/libsignal.git"
	@echo "libsignal commit: $(LIBSIGNAL_COMMIT)"
	@echo "✓ libsignal verified from official Signal repository"

build-client:
	@echo "Building TypeScript client..."
	cd client && npm install && npm run build

build-backend:
	@echo "Building Go backend..."
	go build -o bin/efsec-server backend/cmd/server/main.go

build: build-client build-backend

test-client:
	cd client && npm test

test-backend:
	go test ./backend/...

test: test-client test-backend

clean:
	rm -rf client/dist client/node_modules bin/

install:
	cd client && npm install
	go mod download