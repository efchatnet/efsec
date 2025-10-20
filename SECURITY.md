# Security Policy

## Supported Versions

EfSec is **experimental** and not yet production-ready. Security hardening is ongoing.

## Reporting a Vulnerability

Please email **security@efchat.net** with the subject:  
`[EfSec Security Disclosure] <short title>`

Include:

- A clear description of the issue and potential impact
- Reproduction steps or proof-of-concept
- Affected versions or commits (if known)
- Suggested mitigations (optional)

We acknowledge reports within **48 hours** and will coordinate on fixes and disclosure timelines.

## Scope

- EfSec wrapper code, key handling, and storage logic
- Integration with `@matrix-org/matrix-sdk-crypto-wasm`

Out of scope: upstream Matrix libraries (report to the Matrix.org team).

## Disclosure

Please do not open public issues for vulnerabilities. We will credit researchers upon request when fixes are released.
