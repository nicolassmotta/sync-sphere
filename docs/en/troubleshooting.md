# Troubleshooting

[Documentation](README.md) · [Português (Brasil), detailed reference](../troubleshooting.md)

| Symptom | Next action |
|---|---|
| The app does not open | Keep the launcher terminal open and use its printed URL. Check whether another instance occupies the port. Inspect `/api/health` and `/api/ready`. |
| A connection expired | Reconnect the indicated provider in Connections. Progress and known matches stay saved. |
| A transfer is paused | Check the scheduled resume time. Keep the app running for automatic retry. A rate limit has its own wait policy. |
| Tracks were not found | Open History details and manually search an alternative. Compare title, artist and version before confirming. |
| The playlist exceeds a reading limit | Split it into smaller playlists. A confirmed truncated snapshot is refused before destination creation. |
| Existing local data cannot be opened | Preserve the original files and key. Verify `DATA_DIR`, `ENCRYPTION_KEY` and your backup. Never generate another key over existing data. |
| Language changes are not kept | Browser storage may be disabled. The selection still works for the current session. Supported browser language is used initially, with Portuguese fallback. |
| A provider error stays in another language | Unknown third-party messages are preserved. Share only a sanitized error, never account tokens or private metadata. |

In **Help and security**, preview and download a diagnostic before opening an issue. It excludes credentials, logs, paths, playlist names and account data. Nothing is sent automatically. Include version/commit, OS, Node.js version, providers, reproduction steps and expected behavior.

For restoration, close the server first and follow [backups](backups.md). See [security reporting](security.md) for sensitive vulnerabilities rather than posting secrets in a public issue.
