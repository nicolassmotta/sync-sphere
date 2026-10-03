# Security

[Documentation](README.md) · [Português (Brasil)](../../SECURITY.md)

SyncSphere stores provider credentials in encrypted local files. Protect the data directory, `.env`, installation key and backups. The app has no built-in authentication: run it on a trusted computer and network. Internet exposure requires external access control, proper origins/CORS and secure transport. CORS and encrypted files do not replace server access control.

## Report a vulnerability

Do not publish cookies, tokens, keys or exploitation details in a public issue. If GitHub offers **Report a vulnerability** in the Security tab, use that private channel. Otherwise open an issue requesting a private contact without revealing the vulnerability details.

In a private report, include the affected version/commit, reproduction steps, impact and a suggested fix if available. Use fictional data and test accounts.

## Update safely

Version 1.1.0 remains in preparation. Check the changelog and published release before updating. Back up your local data and key, install locked dependencies and rebuild the interface. Do not change `ENCRYPTION_KEY` when reusing encrypted files.

```bash
npm audit --omit=dev --prefix backend
npm audit --omit=dev --prefix frontend
```

Use a supported Node.js LTS version, such as 22 or 24, according to its [official schedule](https://nodejs.org/en/about/previous-releases). Encryption protects files at rest; environment secrets and the local key also require restrictive permissions and protected copies.
