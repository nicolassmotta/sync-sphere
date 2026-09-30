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
        description: 'Origem ou destino. O back-end lê playlists e cria playlists privadas no YouTube Music usando o cookie da sua sessão no navegador. Aceita links de music.youtube.com e youtube.com; a playlist criada aparece nos dois.',
        setupSteps: [
            'Abra music.youtube.com logado na conta que vai usar.',
            'Nas ferramentas de desenvolvedor, aba Rede, clique em uma requisição para music.youtube.com.',
            'Copie o cabeçalho Cookie completo e cole abaixo (ou em YTMUSIC_COOKIE no backend/.env).',
        ],
        credentialWarning: 'Integração não oficial via cookie. O cookie fica cifrado em backend/data; não o coloque em logs, commits ou capturas de tela.',
        envSnippet: `YTMUSIC_COOKIE=cole_o_cabecalho_cookie_completo_de_music_youtube_com_aqui
YTMUSIC_AUTH_USER=0`,
    },
    deezer: {
        label: 'Deezer',
        tone: 'neutral',
        buttonVariant: 'secondary',
        accentGradient: 'via-[#A238FF]',
        description: 'Origem ou destino. Playlists públicas e a busca funcionam sem login pela API aberta do Deezer, com busca exata por ISRC. Para listar suas playlists, ler privadas e criar playlists, cole o cookie arl.',
        setupSteps: [
            'Sem nada configurado: cole o link de uma playlist pública do Deezer como origem.',
            'Para usar como destino: abra deezer.com logado, ferramentas de desenvolvedor, aba Aplicativo (Application) > Cookies > https://www.deezer.com.',
            'Copie o valor do cookie "arl" (texto hexadecimal longo) e cole abaixo.',
        ],
        credentialWarning: 'O arl dá acesso à sua conta Deezer. Fica cifrado em backend/data; não compartilhe nem coloque em logs ou capturas de tela.',
        envSnippet: 'DEEZER_ARL=cole_o_cookie_arl_de_deezer_com_aqui',
    },
    tidal: {
        label: 'TIDAL',
        tone: 'neutral',
        buttonVariant: 'inverse',
        accentGradient: 'via-cyan-300',
        description: 'Origem ou destino pela API oficial do TIDAL (OAuth + PKCE), com busca exata por ISRC. Playlists criadas ficam como "não listadas": só abre quem tiver o link.',
        setupSteps: [
            'Crie um app em developer.tidal.com e copie o Client ID para TIDAL_CLIENT_ID no backend/.env.',
            'Cadastre a Redirect URI http://127.0.0.1:8000/api/v1/integrations/tidal/callback no app.',
            'Opcional: TIDAL_CLIENT_SECRET permite ler playlists públicas e buscar sem conectar a conta.',
            'Reinicie o back-end e clique em "Conectar TIDAL".',
        ],
        envSnippet: `TIDAL_CLIENT_ID=seu_client_id_tidal
# TIDAL_CLIENT_SECRET=opcional
TIDAL_REDIRECT_URI=http://127.0.0.1:8000/api/v1/integrations/tidal/callback`,
    },
    appleMusic: {
        label: 'Apple Music',
        tone: 'neutral',
        buttonVariant: 'secondary',
        accentGradient: 'via-[#FA2D48]',
        description: 'Origem ou destino. Playlists do catálogo e a busca (com ISRC) funcionam sem configurar nada. Para listar sua biblioteca e criar playlists, conecte a conta.',
        setupSteps: [
            'Sem nada configurado: cole o link de uma playlist pública do Apple Music como origem.',
            'Oficial: com conta Apple Developer, crie uma chave MusicKit, defina APPLE_TEAM_ID, APPLE_KEY_ID e APPLE_PRIVATE_KEY_PATH no backend/.env e use "Conectar com Apple Music".',
            'Sem conta de desenvolvedor: abra music.apple.com logado, ferramentas de desenvolvedor > Aplicativo > Cookies e copie o valor de "media-user-token".',
        ],
        credentialWarning: 'O Music User Token dá acesso à sua biblioteca. Fica cifrado em backend/data; não compartilhe.',
        envSnippet: `APPLE_TEAM_ID=seu_team_id
APPLE_KEY_ID=id_da_chave_musickit
APPLE_PRIVATE_KEY_PATH=/caminho/AuthKey_XXXXXXXXXX.p8`,
    },
    soundcloud: {
        label: 'SoundCloud',
        tone: 'neutral',
        buttonVariant: 'secondary',
        accentGradient: 'via-[#FF5500]',
        description: 'Origem ou destino. Playlists públicas e a busca funcionam sem login. O catálogo tem muito upload de terceiros: faixas sem o mesmo artista ficam como não encontradas em vez de virar um cover.',
        setupSteps: [
            'Sem nada configurado: cole o link de uma playlist (set) pública do SoundCloud como origem.',
            'Para usar como destino: abra soundcloud.com logado, ferramentas de desenvolvedor > Aplicativo > Cookies e copie o valor de "oauth_token".',
            'A API oficial só libera credenciais para contas Artist Pro; por isso a integração usa a sessão do site (não oficial).',
        ],
        credentialWarning: 'O oauth_token dá acesso à sua conta SoundCloud. Fica cifrado em backend/data; não compartilhe.',
        envSnippet: 'SOUNDCLOUD_OAUTH_TOKEN=cole_o_cookie_oauth_token_aqui',
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
