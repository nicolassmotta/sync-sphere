# Getting started

[Documentation](README.md) · [Português (Brasil)](../getting-started.md)

## Install from source

Install Git, Node.js and npm. Use Node.js 22 or 24 LTS. The technical minimum is Node.js 20, outside official support. Check the [Node.js schedule](https://nodejs.org/en/about/previous-releases).

```bash
git clone https://github.com/nicolassmotta/sync-sphere.git
cd sync-sphere
npm run setup
npm run open
```

`setup` installs both applications and builds the interface. `open` creates configuration only if missing and opens the browser. Keep the launcher terminal open during transfers. The default address is `http://localhost:8000`; the server binds to `127.0.0.1` by default.

Choose **Try without accounts**. You do not need provider credentials for File to File. Use the header language selector to change between English and Portuguese. A supported saved preference takes priority over your browser's languages; unsupported languages fall back to Portuguese.

## Configure and start manually

If you prefer manual setup, copy the example configuration on Linux/macOS:

```bash
cp backend/.env.example backend/.env
npm start
```

On Windows PowerShell, use `Copy-Item backend/.env.example backend/.env`. Leave optional music credentials empty for the demonstration. An encryption key is generated locally when no key is configured. Never replace a key used by existing data.

To check the server:

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/ready
```

Expected statuses are `OK` and `ready`. PowerShell may require `curl.exe`. Readiness returns HTTP 503 if essential stored data cannot be opened.

## Connect services

Follow the [integration guide](integrations.md). Spotify and TIDAL Client IDs can be saved from the panel. Some advanced app settings still require `.env`. Panel credentials take priority over equivalent environment values; `.env` changes require restarting the server.

## Stop and update

Stop the server with `Ctrl+C`. Closing the browser tab alone does not stop it. Start again with `npm run open` or `npm start`. Keep the data directory and its original key so queued work and history can be recovered.

Before updating, create a [protected backup](backups.md), stop the server, and separately preserve `.env`. Update the source to your chosen version, then run:

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm run build
npm start
```

Check health, readiness, connections and history before starting another transfer. See [portable packages](distribution.md) for installing without a separate Node.js runtime, or [contributing](contributing.md) for Vite development.
