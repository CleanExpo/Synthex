# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through this repository's **Security** tab using
**Report a vulnerability**:
https://github.com/CleanExpo/Synthex/security/advisories/new

Include what you found, how to reproduce it, and the impact you expect.
You will get an acknowledgement within 5 business days.

## Scope

The `main` branch and the currently deployed production release.

## Secrets

Never commit credentials, API keys, database URLs with passwords, or `.env`
files. If a secret is committed, treat it as compromised and rotate it at the
provider; removing it from the file does not remove it from git history.
