import { readStore, writeStore } from '../storage/jsonStore.js';

/**
 * No modo local não há contas nem login: existe um único "usuário" implícito,
 * que é a pessoa dona da máquina. Este módulo mantém a mesma API que o restante
 * do código já consumia do model Mongoose (`User.findById(...).select(...)` e
 * `instance.save()`), mas guarda apenas os tokens do Spotify em um arquivo local
 * cifrado (`data/credentials.json`). O cookie do YouTube Music continua vindo de
 * `process.env.YTMUSIC_COOKIE`.
 */
const CREDENTIALS_STORE = 'credentials.json';
export const LOCAL_USER_ID = 'local';

const PERSISTED_FIELDS = ['spotifyToken', 'spotifyRefreshToken', 'spotifyTokenExpiresAt'];

class LocalAccount {
    constructor(data = {}) {
        this._id = LOCAL_USER_ID;
        this.id = LOCAL_USER_ID;
        this.spotifyToken = data.spotifyToken ?? null;
        this.spotifyRefreshToken = data.spotifyRefreshToken ?? null;
        this.spotifyTokenExpiresAt = data.spotifyTokenExpiresAt
            ? new Date(data.spotifyTokenExpiresAt)
            : null;
    }

    async save() {
        const snapshot = {};
        for (const field of PERSISTED_FIELDS) {
            snapshot[field] = this[field] ?? null;
        }
        writeStore(CREDENTIALS_STORE, snapshot);
        return this;
    }
}

let account = null;

const getAccount = () => {
    if (!account) {
        account = new LocalAccount(readStore(CREDENTIALS_STORE, {}));
    }
    return account;
};

// Query "thenable" que ignora projeções (`.select`) e sempre resolve para a conta local.
const makeQuery = () => {
    const promise = Promise.resolve().then(() => getAccount());
    promise.select = () => makeQuery();
    return promise;
};

const User = {
    findById() {
        return makeQuery();
    },
    findOne() {
        return makeQuery();
    },
};

export default User;
