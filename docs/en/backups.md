# Backups and recovery

[Documentation](README.md) · [Português (Brasil)](../backups.md)

## Create a protected backup

Wait until the queue is empty, including paused jobs. Open **Help and security > Create an encrypted backup**, choose and repeat a password of at least 12 characters, and download the `.ssb` file. Store the backup and its password securely and separately. The application cannot recover that password.

Backups use scrypt-derived keys and AES-256-GCM, independent of the installation encryption key. They include persisted credentials, panel Client IDs, history, queue, per-track state, file imports and exports. They exclude `.env`, installation keys, logs, cache and disposable statistics. Preserve environment-only settings separately. Content above 64 MB is explicitly refused.

## Restore with the app closed

1. Stop the server/launcher, not just the browser tab.
2. Preserve a copy of the current installation.
3. In a portable package, open `Restaurar-backup` for your system. In a source installation, run:

```bash
npm run backup:restore -- --interactive
```

4. Select the `.ssb` file, type the literal confirmation **RESTAURAR**, and enter its password. The launcher/restore terminal prompts currently remain in Portuguese.
5. Start SyncSphere and check History and Connections. Restored sessions may have expired and need authorization again.

A file can also be supplied explicitly:

```bash
npm run backup:restore -- path/to/backup.ssb --confirm
```

The password is entered in the terminal, never passed as an argument. `DATA_DIR` and `DOTENV_CONFIG_PATH` select the installation to restore. Check them before confirming replacement. Restore changes local state, not playlists in external accounts.

## Protection and limitations

The whole backup is decrypted and validated before replacement. Collections are re-encrypted with the destination installation key; the original source key is not needed. An exclusive `server.lock` prevents restore during server use. An encrypted journal preserves previous bytes, rolls back failures, and recovers interrupted restore before collections are opened at startup.

If recovery fails, preserve files and backup before trying again. These mechanisms do not replace copies on another device or guarantee recovery from disk damage. Do not restore an unknown backup. Local recovery is not a distributed transaction with music services.
