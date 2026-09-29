/**
 * Metadados visuais das plataformas. O back-end é a fonte da verdade sobre
 * quais plataformas existem e o que cada uma suporta (`GET /integrations/status`);
 * aqui ficam só cores, textos de ajuda e passos de configuração.
 * Plataforma sem entrada aqui usa o visual genérico.
 */
export const DEFAULT_SOURCE_PROVIDER = 'spotify';
export const DEFAULT_TARGET_PROVIDER = 'youtubeMusic';

export const PROVIDER_UI = {
    spotify: {
        label: 'Spotify',
        tone: 'spotify',
        buttonVariant: 'primary',
        accentGradient: 'via-spotify',
        description: 'Origem ou destino. O back-end usa OAuth para listar playlists, buscar faixas e criar playlists privadas quando o Spotify for destino.',
        setupSteps: [
            'Crie um app no painel do Spotify e defina SPOTIFY_CLIENT_ID no backend/.env.',
            'Cadastre SPOTIFY_REDIRECT_URI=http://127.0.0.1:8000/api/v1/integrations/spotify/callback no Spotify.',
            'Reconecte se o app antigo não tiver playlist-modify-private/playlist-modify-public.',
            'Clique em "Conectar" e autorize sua conta no navegador (OAuth + PKCE, sem Client Secret).',
        ],
    },
    youtubeMusic: {
        label: 'YouTube Music',
        tone: 'youtube',
        buttonVariant: 'youtube',
        accentGradient: 'via-youtube',
        description: 'Origem ou destino. O back-end lê playlists e cria playlists privadas no YouTube Music usando o cookie da sua sessão no navegador.',
        setupSteps: [
            'Abra music.youtube.com logado na conta que vai usar.',
            'Nas ferramentas de desenvolvedor, aba Rede, clique em uma requisição para music.youtube.com.',
            'Copie o cabeçalho Cookie completo e cole abaixo (ou em YTMUSIC_COOKIE no backend/.env).',
        ],
        credentialWarning: 'Integração não oficial via cookie. O cookie fica cifrado em backend/data; não o coloque em logs, commits ou capturas de tela.',
        envSnippet: `YTMUSIC_COOKIE=cole_o_cabecalho_cookie_completo_de_music_youtube_com_aqui
YTMUSIC_AUTH_USER=0`,
    },
    file: {
        label: 'Arquivo',
        tone: 'neutral',
        buttonVariant: 'secondary',
        accentGradient: 'via-sky-300',
        description: 'Ponte para qualquer app: importe CSV (Exportify e outros), JSON, M3U/M3U8 ou TXT como origem, ou gere um arquivo como destino.',
        setupSteps: [
            'Não precisa de conexão.',
            'Como origem: escolha Arquivo na aba Início e clique em "Importar arquivo".',
            'CSV precisa de uma coluna de nome da faixa ("Track Name", "name", "title" ou "música"); artista, álbum, ISRC e duração são opcionais.',
            'TXT: uma faixa por linha no formato "Artista - Título".',
            'Como destino: ao terminar, baixe o resultado em CSV, JSON, M3U ou TXT pelo Histórico.',
        ],
    },
};

export const FILE_EXPORT_FORMATS = [
    { format: 'csv', label: 'CSV' },
    { format: 'json', label: 'JSON' },
    { format: 'm3u', label: 'M3U' },
    { format: 'txt', label: 'TXT' },
];

const GENERIC_UI = {
    tone: 'neutral',
    buttonVariant: 'secondary',
    accentGradient: 'via-white/30',
    description: 'Plataforma de música integrada ao SyncSphere.',
    setupSteps: [],
};

export const getProviderUi = (providerId) => PROVIDER_UI[providerId] || { ...GENERIC_UI, label: providerId };

export const getProviderLabel = (providerId, providers = []) => (
    providers.find((provider) => provider.id === providerId)?.label
    || PROVIDER_UI[providerId]?.label
    || providerId
    || 'Plataforma'
);

// Transferências antigas só têm `direction`.
const LEGACY_DIRECTIONS = {
    spotify_to_youtube: ['spotify', 'youtubeMusic'],
    youtube_to_spotify: ['youtubeMusic', 'spotify'],
};

export const getTransferProviders = (transfer) => {
    const [legacySource, legacyTarget] = LEGACY_DIRECTIONS[transfer?.direction] || [];
    return {
        sourceProvider: transfer?.sourceProvider || legacySource || DEFAULT_SOURCE_PROVIDER,
        targetProvider: transfer?.targetProvider || legacyTarget || DEFAULT_TARGET_PROVIDER,
    };
};
