# Troubleshooting

[Documentation](README.md) · [Português (Brasil), detailed reference](../troubleshooting.md)

| Symptom | Next action |
|---|---|
| The app does not open | Keep the launcher terminal open and use its printed URL. If the launcher says the port is in use by another program, close it or set another `PORT` in `backend/.env`; the dashboard served on the new port is accepted automatically. Inspect `/api/health` and `/api/ready`. |
| The dashboard shows **App stopped** | The terminal window was closed or the server stopped. Start it again and use **Retry**; saved progress resumes. |
| YouTube Music rejects the cookie | Copy the complete Cookie header again, or paste the whole **Copy as cURL** command: the dashboard extracts the Cookie. |
| I want to delete old transfers | Open a finished transfer in History and use **Remove from history**. |
| A connection expired | Reconnect the indicated provider in Connections. Progress and known matches stay saved. |
| A transfer is paused | Check the scheduled resume time. Keep the app running for automatic retry. A rate limit has its own wait policy. |
| Tracks were not found | Open History details and manually search an alternative. Compare title, artist and version before confirming. |
| The playlist exceeds a reading limit | Split it into smaller playlists. A confirmed truncated snapshot is refused before destination creation. |
| Existing local data cannot be opened | Preserve the original files and key. Verify `DATA_DIR`, `ENCRYPTION_KEY` and your backup. Never generate another key over existing data. |
| Language changes are not kept | Browser storage may be disabled. The selection still works for the current session. Supported browser language is used initially, with Portuguese fallback. |
| A provider error stays in another language | Unknown third-party messages are preserved. Share only a sanitized error, never account tokens or private metadata. |

In **Help and security**, preview and download a diagnostic before opening an issue. It excludes credentials, logs, paths, playlist names and account data. Nothing is sent automatically. Include version/commit, OS, Node.js version, providers, reproduction steps and expected behavior.

For restoration, close the server first and follow [backups](backups.md). See [security reporting](security.md) for sensitive vulnerabilities rather than posting secrets in a public issue.
