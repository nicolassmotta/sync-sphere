# Portable packages

[Documentation](README.md) · [Português (Brasil)](../distribution.md)

Packages include Node.js and production dependencies. Each published version attaches them to [Releases](https://github.com/nicolassmotta/sync-sphere/releases). Local generation does not publish a tag or GitHub Release.

## Use a package

Download the file for your OS/architecture from the Release: `win-x64` for most Windows PCs, `darwin-arm64` for Apple Silicon Macs (M1 or newer), `darwin-x64` for Intel Macs, `linux-x64` for most Linux PCs. Optionally compare its checksum with `SHA256SUMS.txt`, then extract the complete folder. Open `Iniciar.cmd` on Windows, `Iniciar.command` on macOS, or `Iniciar.sh` on Linux. Keep its terminal open during transfers. If the browser does not open, use the printed local URL.

Windows uses ZIP; Linux/macOS use TAR.GZ. These are unsigned portable packages, not signed installers, so the system may ask for confirmation the first time. On Windows, under **Windows protected your PC**, choose **More info** and **Run anyway**. On macOS, if the developer cannot be verified, open **System Settings > Privacy & Security** and choose **Open Anyway**. Only do this for packages from the official Releases page, and do not disable system protections. Launcher filenames and terminal prompts currently remain in Portuguese; the browser interface supports both languages.

## Build locally

From the repository root with Node.js, npm, `tar`, `unzip` and `zip` available:

```bash
npm run package -- --target linux-x64
npm run package -- --target win-x64
npm run package -- --target darwin-arm64
```

Or use `npm run package -- --all` for all six targets: Linux, macOS and Windows, each x64/arm64. Default runtime is Node.js 24.15.0. `--node-version` selects an explicit version. Downloads use nodejs.org and are verified against the same version's `SHASUMS256.txt`.

Artifacts in ignored `artifacts/` carry the `package.json` version in their name, plus a manifest and checksum. Explicit copy paths include built frontend, backend production dependencies, shared translation catalogs and runtime license. Local `.env`, data, logs and credentials are excluded. The panel uses a relative API URL. There is no silent runtime update.

## Check a package

On the package's own OS and architecture, run `node scripts/verify-package.mjs artifacts/syncsphere-1.1.0-linux-x64.tar.gz`. It checks the SHA-256 checksum, the manifest target and that no `.env` or local data is included, then extracts to a temporary folder, starts the launcher with `--no-browser` on port 18765 (or `--port`), waits for the panel and stops the app.

## Release workflow

Pushing a `vX.Y.Z` tag runs the [Release workflow](../../.github/workflows/release.yml). It checks that versions, the dated CHANGELOG entry and `docs/releases/vX.Y.Z.md` match the tag, runs the full CI, builds the six packages and `SHA256SUMS.txt`, opens each package on a runner of its own OS (Linux, macOS and Windows, x64 and ARM), and only then creates the GitHub Release with the packages attached. Pull requests touching packaging and manual runs stop before publishing.

## Update safely

Create a [protected backup](backups.md), stop the app, and extract the new package into another folder. Keep the old installation until you restore and check history, connections and exports. Preserve environment-only settings separately. Never replace an entire running installation folder.
