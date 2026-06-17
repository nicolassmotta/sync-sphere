import crypto from 'crypto';
import { readStore, writeStore } from '../storage/jsonStore.js';
import {
    TRANSFER_DIRECTIONS,
    TRANSFER_PROVIDERS,
} from '../constants/transferDirections.js';

/**
 * Histórico de transferências persistido localmente em `data/transfers.json`
 * (cifrado). Mantém a mesma API que o restante do código já usava do model
 * Mongoose (`insertMany`, `findById`, `findOne().select()`, `find().sort().limit()`
 * e `instance.save()`), evitando alterações nos services e controllers.
 */
const TRANSFERS_STORE = 'transfers.json';

const DEFAULTS = () => ({
    sourceProvider: TRANSFER_PROVIDERS.SPOTIFY,
    targetProvider: TRANSFER_PROVIDERS.YOUTUBE_MUSIC,
    direction: TRANSFER_DIRECTIONS.SPOTIFY_TO_YOUTUBE,
    targetPlaylistId: null,
    targetPlaylistUrl: null,
    targetPlaylistDescription: null,
    targetPlaylistImageUrl: null,
    targetPlaylistImageSynced: false,
    lastMessage: '',
    status: 'pending',
    totalTracks: 0,
    processedTracks: 0,
    errors: [],
});

class TransferRecord {
    constructor(data = {}) {
        Object.assign(this, data);
    }

    async save() {
        this.updatedAt = new Date().toISOString();
        const list = load();
        if (!list.includes(this)) {
            list.push(this);
        }
        persist();
        return this;
    }
}

let records = null;

const load = () => {
    if (!records) {
        records = readStore(TRANSFERS_STORE, []).map((item) => new TransferRecord(item));
    }
    return records;
};

const persist = () => {
    writeStore(TRANSFERS_STORE, load().map((record) => ({ ...record })));
};

const matches = (record, query = {}) => (
    Object.entries(query).every(([key, value]) => String(record[key]) === String(value))
);

// Query "thenable" para suportar `find(...).sort(...).limit(...)` e `findOne(...).select(...)`.
const makeListQuery = (initial) => {
    let result = [...initial];

    const query = {
        sort(spec = {}) {
            const [field, order] = Object.entries(spec)[0] || [];
            if (field) {
                result.sort((a, b) => {
                    const av = a[field];
                    const bv = b[field];
                    if (av === bv) return 0;
                    const comparison = av > bv ? 1 : -1;
                    return order === -1 ? -comparison : comparison;
                });
            }
            return query;
        },
        limit(count) {
            result = result.slice(0, count);
            return query;
        },
        then(resolve, reject) {
            return Promise.resolve(result).then(resolve, reject);
        },
    };

    return query;
};

const makeSingleQuery = (resolver) => {
    const promise = Promise.resolve().then(resolver);
    promise.select = () => makeSingleQuery(resolver);
    return promise;
};

const Transfer = {
    async insertMany(docs = []) {
        const list = load();
        const now = new Date().toISOString();
        const created = docs.map((doc) => new TransferRecord({
            _id: crypto.randomUUID(),
            ...DEFAULTS(),
            ...doc,
            createdAt: now,
            updatedAt: now,
        }));
        list.push(...created);
        persist();
        return created;
    },

    async findById(id) {
        return load().find((record) => String(record._id) === String(id)) || null;
    },

    findOne(query = {}) {
        return makeSingleQuery(() => load().find((record) => matches(record, query)) || null);
    },

    find(query = {}) {
        return makeListQuery(load().filter((record) => matches(record, query)));
    },
};

export default Transfer;
