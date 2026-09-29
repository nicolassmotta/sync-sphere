/**
 * Gateway interno do site do Deezer (`gw-light.php`), autenticado pelo cookie
 * `arl` da sessão do navegador. Não é API oficial: é o que o próprio site usa
 * para criar playlists e ler playlists privadas. Protocolo conforme o cliente
 * de código aberto deemix (deezer-sdk/gw.ts).
 */
const GATEWAY_URL = 'https://www.deezer.com/ajax/gw-light.php';
const INVALID_TOKEN_ERRORS = new Set([
    '{"GATEWAY_ERROR":"invalid api token"}',
    '{"VALID_TOKEN_REQUIRED":"Invalid CSRF token"}',
]);

export const DEEZER_PLAYLIST_STATUS = { PUBLIC: 0, PRIVATE: 1 };

export class DeezerGatewayError extends Error {
    constructor(message, { status, kind } = {}) {
        super(message);
        this.name = 'DeezerGatewayError';
        this.status = status;
        this.kind = kind;
    }
}

const readSetCookies = (response) => (
    typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie')].filter(Boolean)
);

export const createDeezerGateway = ({ arl }) => {
    const cookies = new Map([['arl', arl]]);
    let apiToken = null;
    let userData = null;

    const cookieHeader = () => [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');

    const rawCall = async (method, args = {}) => {
        const url = new URL(GATEWAY_URL);
        url.searchParams.set('api_version', '1.0');
        url.searchParams.set('api_token', method === 'deezer.getUserData' ? 'null' : apiToken);
        url.searchParams.set('input', '3');
        url.searchParams.set('method', method);

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Cookie: cookieHeader(),
            },
            body: JSON.stringify(args),
        });

        // A sessão (`sid`) criada no getUserData precisa acompanhar o token.
        readSetCookies(response).forEach((header) => {
            const [pair] = header.split(';');
            const separator = pair.indexOf('=');
            if (separator > 0) cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
        });

        if (!response.ok) {
            throw new DeezerGatewayError(`Deezer respondeu HTTP ${response.status}.`, { status: response.status });
        }
        return response.json();
    };

    const getUserData = async () => {
        const data = await rawCall('deezer.getUserData');
        const results = data?.results || {};
        if (!results.USER?.USER_ID) {
            throw new DeezerGatewayError(
                'O cookie arl do Deezer é inválido ou expirou. Copie um novo em deezer.com.',
                { status: 401, kind: 'auth' }
            );
        }
        apiToken = results.checkForm;
        userData = results;
        return results;
    };

    const call = async (method, args = {}, { retried = false } = {}) => {
        if (!apiToken) await getUserData();

        const data = await rawCall(method, args);
        const error = data?.error;
        const hasError = Array.isArray(error) ? error.length > 0 : error && Object.keys(error).length > 0;
        if (!hasError) return data.results;

        const serialized = JSON.stringify(error);
        if (INVALID_TOKEN_ERRORS.has(serialized) && !retried) {
            apiToken = null;
            return call(method, args, { retried: true });
        }

        throw new DeezerGatewayError(`Deezer recusou ${method}: ${serialized}`, {
            status: /QUOTA|RATE/i.test(serialized) ? 429 : 400,
        });
    };

    return {
        async getUser() {
            const data = userData || await getUserData();
            return {
                id: String(data.USER.USER_ID),
                name: data.USER.BLOG_NAME || data.USER.EMAIL || 'Conta Deezer',
            };
        },

        async listUserPlaylists({ limit = 500 } = {}) {
            const user = await this.getUser();
            const page = await call('deezer.pageProfile', { USER_ID: user.id, tab: 'playlists', nb: limit });
            return page?.TAB?.playlists?.data || [];
        },

        async getPlaylist(playlistId) {
            return call('deezer.pagePlaylist', {
                PLAYLIST_ID: playlistId,
                lang: 'pt',
                header: true,
                tab: 0,
                nb: 0,
            });
        },

        async getPlaylistSongs(playlistId) {
            const page = await call('playlist.getSongs', { PLAYLIST_ID: playlistId, nb: -1 });
            return page?.data || [];
        },

        async createPlaylist({ title, description, status = DEEZER_PLAYLIST_STATUS.PRIVATE }) {
            return call('playlist.create', { title, status, description, songs: [] });
        },

        async addSongs({ playlistId, songIds }) {
            return call('playlist.addSongs', {
                PLAYLIST_ID: playlistId,
                songs: songIds.map((songId) => [Number(songId), 0]),
                offset: -1,
            });
        },
    };
};
