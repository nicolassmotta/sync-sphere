# Integrations and privacy

[Documentation](README.md) · [Português (Brasil), detailed provider reference](../integrations.md)

Configure only the providers needed for your transfer. **Connections** shows a step-by-step guide and each platform's capabilities. Credentials are encrypted locally. Treat cookies and account tokens like passwords; never paste them into issues, screenshots or logs.

| Provider | Connection and capabilities |
|---|---|
| Spotify | Create a Spotify app, register the callback URI shown by the panel, save its Client ID, then authorize via OAuth with PKCE. No Client Secret is required. API permissions govern account/link reads and private playlist creation. |
| YouTube Music | Copy the complete Cookie request header from an authenticated music.youtube.com session into the panel. This unofficial connection reads playlists and creates private playlists visible on YouTube Music/YouTube. |
| Deezer | Public reads/search need no login. Paste the account's `arl` cookie to list account playlists, read private playlists and create playlists. Authenticated website operations are unofficial. |
| TIDAL | Create an app, register the callback URI shown, save the Client ID, and authorize OAuth with PKCE. Playlist writing is experimental and requires real-account validation. Compatible app configuration may enable public reads. |
| Apple Music | Public catalog reads/search work without account configuration. MusicKit authorization is available when its developer configuration is present; the panel also supports an alternative account token flow. Library writing requires account authorization. |
| SoundCloud | Public reads/search need no login. `oauth_token` enables account operations through the unofficial website session. Official API credentials are restricted to eligible accounts. |
| File | No credentials. Import CSV, JSON, M3U/M3U8 or TXT and export metadata in supported formats. |

A connected state does not guarantee that every playlist/track is available. Catalog differences, permissions and platform changes can affect matching and insertion. Reconnect expired credentials when asked; existing matches and progress stay saved.

Panel credentials override equivalent `.env` values immediately. Environment-only app configuration requires a restart and is not included in the protected backup. See the detailed Portuguese reference linked above for provider-specific environment variables and advanced methods, and [usage](usage.md#reading-limits) for current reading limits.

File demonstration and automated tests do not write to real accounts. Writes to Deezer, TIDAL, Apple Music and SoundCloud remain pending real-account validation.
