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

// Um índice por processo reúne atualizações de todas as raias de destino.
let entries = null;
let dirty = false;
let disabled = false;
let timer = null;
let pendingWrites = 0;
const CHECKPOINT_SIZE = 100;
const FLUSH_DELAY_MS = 1000;

const loadEntries = () => {
    if (!entries) {
        const stored = readStore(STORE, {});
        entries = new Map(Object.entries(stored || {}).filter(([, entry]) => entry && typeof entry === 'object')
            .sort(([, a], [, b]) => a.savedAt - b.savedAt).slice(-MATCH_CACHE_LIMIT));
    }
    return entries;
};

export const flushMatchCache = () => {
    clearTimeout(timer);
    timer = null;
    if (!dirty || disabled) return;
    try {
        writeStore(STORE, Object.fromEntries(entries));
        dirty = false;
        pendingWrites = 0;
    } catch {
        disabled = true;
        logger.warn('Cache de correspondências indisponível. A transferência continuará com buscas normais.');
    }
};

// Usado para simular reinício sem misturar índices entre testes isolados.
export const resetMatchCacheForTests = () => {
    clearTimeout(timer);
    timer = null;
    entries = null;
    dirty = false;
    disabled = false;
    pendingWrites = 0;
};

/** Correspondências confiáveis cifradas, compartilhadas entre transferências. */
export default class MatchCache {
    constructor({ scope, now = () => Date.now() }) {
        this.scope = scope;
        this.now = now;
    }

    get(track) {
        if (disabled) return null;
        try {
            const entry = loadEntries().get(keyFor(this.scope, track));
            if (!entry?.targetId || !Number.isFinite(entry.matchScore)
                || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= this.now()) return null;
            return { targetId: entry.targetId, matchScore: entry.matchScore };
        } catch {
            return null;
        }
    }

    set(track, { targetId, matchScore }) {
        if (disabled || !targetId || !Number.isFinite(matchScore) || matchScore < 45) return;
        try {
            const now = this.now();
            const index = loadEntries();
            const key = keyFor(this.scope, track);
            index.delete(key);
            index.set(key, { targetId, matchScore, savedAt: now, expiresAt: now + MATCH_CACHE_TTL_MS });
            while (index.size > MATCH_CACHE_LIMIT) index.delete(index.keys().next().value);
            dirty = true;
            pendingWrites += 1;
            if (pendingWrites >= CHECKPOINT_SIZE) this.flush();
            else if (!timer) {
                timer = setTimeout(flushMatchCache, FLUSH_DELAY_MS);
                timer.unref?.();
            }
        } catch {
            disabled = true;
            logger.warn('Cache de correspondências indisponível. A transferência continuará com buscas normais.');
        }
    }

    flush() {
        if (entries && dirty) {
            const now = this.now();
            for (const [key, entry] of entries) {
                if (!Number.isFinite(entry.expiresAt) || entry.expiresAt <= now) entries.delete(key);
            }
        }
        flushMatchCache();
    }
}
