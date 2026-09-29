import { findProvider, getProvider, listProviders } from '../src/providers/registry.js';
import {
    buildTransferDirection,
    getTransferDirectionProviders,
    resolveTransferProviders,
} from '../src/constants/transferDirections.js';

const REQUIRED_FUNCTIONS = [
    'getStatus',
    'ensureReadable',
    'ensureWritable',
    'normalizePlaylistId',
    'getPlaylistSnapshot',
    'getPlaylistPreview',
    'createSearchClient',
    'getMatchId',
    'createDestinationClient',
    'getSearchDelayMs',
    'disconnect',
];

describe.each(listProviders().map((provider) => [provider.id, provider]))('contrato do provedor %s', (id, provider) => {
    it('declara identidade, autenticação e capacidades', () => {
        expect(provider.id).toBe(id);
        expect(provider.label).toEqual(expect.any(String));
        expect(['oauth', 'cookie', 'none', 'file']).toContain(provider.auth.type);
        expect(provider.capabilities).toEqual(expect.objectContaining({
            read: expect.any(Boolean),
            write: expect.any(Boolean),
            listUserPlaylists: expect.any(Boolean),
        }));
    });

    it('implementa as funções obrigatórias', () => {
        REQUIRED_FUNCTIONS.forEach((name) => {
            expect(typeof provider[name]).toBe('function');
        });
        if (provider.capabilities.listUserPlaylists) expect(typeof provider.listPlaylists).toBe('function');
        if (provider.auth.type === 'oauth') {
            expect(typeof provider.oauth.getAuthorizationUrl).toBe('function');
            expect(typeof provider.oauth.handleCallback).toBe('function');
        }
        if (provider.auth.type === 'cookie') expect(typeof provider.saveCredentials).toBe('function');
    });

    it('aceita link completo da playlist e devolve o ID', () => {
        const example = provider.playlistUrlExample.replace('PL...', 'PLabc123');
        const normalized = provider.normalizePlaylistId(example);
        expect(normalized).toBeTruthy();
        expect(normalized).not.toContain('://');
    });

    it('usa atraso de busca numérico', () => {
        expect(Number.isFinite(provider.getSearchDelayMs())).toBe(true);
    });
});

describe('registro de provedores', () => {
    it('encontra por id ou apelido', () => {
        expect(findProvider('youtube-music')?.id).toBe('youtubeMusic');
        expect(findProvider('spotify')?.id).toBe('spotify');
        expect(findProvider('deezer')).toBeNull();
    });

    it('recusa plataforma desconhecida com 404', () => {
        expect(() => getProvider('napster')).toThrow(expect.objectContaining({ statusCode: 404 }));
    });
});

describe('direção da transferência', () => {
    it('mantém os valores antigos para os pares originais', () => {
        expect(buildTransferDirection('spotify', 'youtubeMusic')).toBe('spotify_to_youtube');
        expect(buildTransferDirection('youtubeMusic', 'spotify')).toBe('youtube_to_spotify');
    });

    it('gera e interpreta pares novos no formato origem_to_destino', () => {
        expect(buildTransferDirection('deezer', 'tidal')).toBe('deezer_to_tidal');
        expect(getTransferDirectionProviders('deezer_to_tidal')).toEqual({
            sourceProvider: 'deezer',
            targetProvider: 'tidal',
        });
    });

    it('campos explícitos vencem a direção', () => {
        expect(resolveTransferProviders({
            direction: 'spotify_to_youtube',
            sourceProvider: 'youtubeMusic',
            targetProvider: 'spotify',
        })).toEqual({
            sourceProvider: 'youtubeMusic',
            targetProvider: 'spotify',
            direction: 'youtube_to_spotify',
        });
    });
});
