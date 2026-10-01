import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';

const directory = fs.mkdtempSync(`${os.tmpdir()}/syncsphere-bench-`);
process.env.DATA_DIR = directory;
process.env.DOTENV_CONFIG_PATH = `${directory}/.env`;
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.NODE_ENV = 'test';
const root = new URL('../', import.meta.url);
const { writeStore } = await import(new URL('src/storage/jsonStore.js', root));
const { default: MatchCache } = await import(new URL('src/services/matching/MatchCache.js', root));
const { default: TrackMatcher } = await import(new URL('src/services/transfer/TrackMatcher.js', root));
const { buildTransferTracks } = await import(new URL('src/services/transfer/TransferTrackStore.js', root));
const entries = {};
const tracks = Array.from({ length: 5000 }, (_, i) => ({ name: `música ${i}`, artist: 'artista' }));
for (const track of tracks) {
    const key = crypto.createHash('sha256').update(JSON.stringify([1, 'bench', track.name, track.artist, '', '', 0])).digest('hex');
    entries[key] = { targetId: track.name, matchScore: 95, savedAt: Date.now(), expiresAt: Date.now() + 604800000 };
}
writeStore('match-cache.json', entries);
const cache = new MatchCache({ scope: 'bench' });
let delay;
const start = performance.now();
const timer = new Promise((resolve) => setTimeout(() => {
    delay = performance.now() - start;
    resolve();
}, 0));
await new TrackMatcher({ delayMs: 0 }).matchTracks({
    tracks: buildTransferTracks(tracks.slice(0, 1000)),
    matchCache: cache,
    searchClient: { searchBestMatch() { throw new Error('Cache ausente'); } },
});
const elapsed = performance.now() - start;
await timer;
fs.rmSync(directory, { recursive: true, force: true });
console.log(JSON.stringify({ node: process.version, entries: 5000, hits: 1000, elapsedMs: elapsed, timerDelayMs: delay }));
