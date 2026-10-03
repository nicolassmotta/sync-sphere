# Portable packages

[Documentation](README.md) · [Português (Brasil)](../distribution.md)

Packages include Node.js and production dependencies. Version 1.1.0 remains in preparation. Local generation does not publish a tag or GitHub Release. A generated package must be run on its own operating system before that system is called validated.

## Use a package

Choose the correct OS/architecture, verify its SHA-256 checksum, and extract the complete folder. Open `Iniciar.cmd` on Windows, `Iniciar.command` on macOS, or `Iniciar.sh` on Linux. Keep its terminal open during transfers. If the browser does not open, use the printed local URL.

Windows uses ZIP; Linux/macOS use TAR.GZ. These are unsigned portable packages, not signed installers. Operating system script warnings may appear. Do not disable protections to run an unverified source. Launcher filenames and terminal prompts currently remain in Portuguese; the browser interface supports both languages.

## Build locally

From the repository root with Node.js, npm, `tar`, `unzip` and `zip` available:

```bash
npm run package -- --target linux-x64
npm run package -- --target win-x64
npm run package -- --target darwin-arm64
```

Or use `npm run package -- --all` for all six targets: Linux, macOS and Windows, each x64/arm64. Default runtime is Node.js 24.15.0. `--node-version` selects an explicit version. Downloads use nodejs.org and are verified against the same version's `SHASUMS256.txt`.

Artifacts in ignored `artifacts/` contain a preparation version, manifest and checksum. Explicit copy paths include built frontend, backend production dependencies, shared translation catalogs and runtime license. Local `.env`, data, logs and credentials are excluded. The panel uses a relative API URL. There is no silent runtime update.

## Update safely

Create a [protected backup](backups.md), stop the app, and extract the new package into another folder. Keep the old installation until you restore and check history, connections and exports. Preserve environment-only settings separately. Never replace an entire running installation folder.
