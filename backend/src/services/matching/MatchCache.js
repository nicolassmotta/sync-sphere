import crypto from 'node:crypto';
import { readStore, writeStore } from '../../storage/jsonStore.js';
import logger from '../../utils/logger.js';

const STORE = 'match-cache.json';
export const MATCH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MATCH_CACHE_LIMIT = 5000;

// Mantém título completo, incluindo versões, e duração na identidade da gravação.
const text = (value) => String(value || '').trim().toLowerCase();
const keyFor = (scope, track) => crypto.createHash('sha256').update(JSON.stringify([
    1, scope, text(track.name), text(track.artist), text(track.album),
    text(track.isrc), Number(track.durationMs) || 0,
])).digest('hex');

/** Correspondências confiáveis cifradas, compartilhadas entre transferências. */
export default class MatchCache {
    constructor({ scope, now = () => Date.now() }) {
        this.scope = scope;
        this.now = now;
        this.disabled = false;
    }

    get(track) {
        if (this.disabled) return null;
        const entry = readStore(STORE, {})[keyFor(this.scope, track)];
        if (!entry?.targetId || !Number.isFinite(entry.matchScore)
            || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= this.now()) return null;
        return { targetId: entry.targetId, matchScore: entry.matchScore };
    }

    set(track, { targetId, matchScore }) {
        if (this.disabled || !targetId || !Number.isFinite(matchScore)) return;
        const now = this.now();
        const entries = readStore(STORE, {});
        entries[keyFor(this.scope, track)] = {
            targetId, matchScore, savedAt: now, expiresAt: now + MATCH_CACHE_TTL_MS,
        };
        const bounded = Object.fromEntries(Object.entries(entries)
            .filter(([, entry]) => entry.expiresAt > now)
            .sort(([, a], [, b]) => b.savedAt - a.savedAt)
            .slice(0, MATCH_CACHE_LIMIT));
        try {
            writeStore(STORE, bounded);
        } catch {
            this.disabled = true;
            logger.warn('Cache de correspondências indisponível. A transferência continuará com buscas normais.');
        }
    }
}
