# IMPORT RULES FOR E2E ENCRYPTION

## Dependency Chain
1. **libsignal** (@signalapp/libsignal-client) - The core Signal Protocol library
2. **efsec** (@efchatnet/efsec) - Our E2E wrapper that imports and uses libsignal
3. **efchat** - The main application that ONLY imports efsec

## Critical Rules

### Import Rules
- **efsec** imports `@signalapp/libsignal-client` directly
- **efchat** imports ONLY `@efchatnet/efsec` - NEVER libsignal
- All E2E implementation details MUST be encapsulated in efsec
- efchat should have ZERO knowledge of Signal Protocol internals

### Repository Rules
- **libsignal** is pulled from npm: `@signalapp/libsignal-client`
- **efsec** is pulled from GitHub: `github:efchatnet/efsec`
- Both backend (Go) and frontend (JS/TS) follow the same pattern

### Development Workflow
1. Make changes to efsec
2. Build efsec properly (npm run build -> dist/)
3. Commit AND push efsec to GitHub
4. Update efchat to pull latest efsec from GitHub
5. Test efchat

### Build Requirements
- efsec MUST build to `dist/` folder
- The `dist/` folder MUST be committed to GitHub
- efchat uses the compiled JavaScript from `dist/`, NOT the TypeScript source

## Why This Matters
- **Security Audit**: efsec is the public, auditable E2E implementation
- **Separation of Concerns**: efchat doesn't need to know about Signal Protocol
- **Clean Dependencies**: efchat only has one E2E dependency (efsec)
- **Type Safety**: efchat uses efsec's type definitions from dist/