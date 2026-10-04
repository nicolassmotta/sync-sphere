# Contributing

[Documentation](README.md) · [Português (Brasil)](../../CONTRIBUTING.md)

SyncSphere is local, single-user, with encrypted files and a persisted in-process queue. Preserve this model, backend ESM, provider contracts and Socket.io progress. Do not introduce accounts, MongoDB or Redis.

## Development

Use Node.js 22 or 24 LTS. From the repository root:

```bash
npm ci --prefix backend
npm ci --prefix frontend
cp backend/.env.example backend/.env
npm run build
npm start
```

On PowerShell use `Copy-Item backend/.env.example backend/.env`. For live frontend development, run `npm run dev:backend` and `npm run dev:frontend` in separate terminals. Backend defaults to port 8000, Vite to 5173. Check `FRONTEND_URL` and `VITE_API_URL` against the actual ports.

Create a branch from current main, reproduce the problem, implement focused behavior tests, update relevant docs and changelog, and review the diff. Format only changed files. Use English code identifiers and Conventional Commits with Portuguese descriptions. Internal maintenance docs/comments remain Portuguese. Public UI messages need both PT/EN catalog entries; see [localization maintenance](../localization.md), currently in Portuguese.

## Validation

```bash
npm test --prefix backend
npm test --prefix frontend
npm run test:i18n --prefix frontend
npm run lint
npm run build
npm audit --omit=dev --prefix backend
npm audit --omit=dev --prefix frontend
git diff --check
```

Use temporary data directories, fictional credentials and simulated external responses. Never include `.env`, local data or personal logs. Check health/readiness and the affected browser flow. Explain the problem, resulting behavior, checks actually run and validation limits in your PR.

Provider insertion receives pending `ids` plus complete resolved `expectedIds`. Reconcile occurrence counts before writing; propagate destination read failures. Test intentional repeats and resume after partial writes. Declare official/unofficial methods and limits. Simulated tests do not prove account writes.

## First contributions

Try a keyboard/mobile flow, improve a guide, verify reports against a File transfer, or run a portable package on your operating system. Documentation examples must be fictional. Check local links and commands. When reporting a bug, include reproduction details and remove tokens, private URLs and personal data.

Read [security](security.md) for vulnerability reports. No published release should be declared ready while integrity/recovery blockers or required validation remain unresolved.
