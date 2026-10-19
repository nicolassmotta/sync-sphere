import { translate } from '../i18n';
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
        description: 'Leia suas playlists ou crie uma nova playlist privada no Spotify. Você autoriza a conexão no navegador da plataforma.',
        createdVisibility: 'Visibilidade: privada.',
        setupSteps: [
            'Abra developer.spotify.com/dashboard, entre com sua conta do Spotify e clique em Create app. O Spotify exige Premium na conta dona do aplicativo.',
            'Dê qualquer nome e descrição. Em Redirect URIs, cole o endereço de retorno mostrado abaixo e clique em Add. Marque Web API, aceite os termos e salve.',
            'No aplicativo criado, abra Settings, copie o Client ID e cole no campo abaixo. Não precisa de Client Secret.',
            'Clique em Conectar Spotify e autorize no navegador. Depois volte à migração.',
            'Vai conectar outra conta do Spotify, diferente da que criou o aplicativo? Adicione o e-mail dela em User Management, no painel do aplicativo.',
        ],
    },
    youtubeMusic: {
        label: 'YouTube Music',
        tone: 'youtube',
        buttonVariant: 'youtube',
        accentGradient: 'via-youtube',
        description: 'Leia playlists ou crie uma playlist privada no YouTube Music usando a sessão da sua conta. Aceita links de music.youtube.com e youtube.com; a playlist criada aparece nos dois.',
        createdVisibility: 'Visibilidade: privada.',
        setupSteps: [
            'No navegador do computador, abra music.youtube.com já logado na conta que vai usar.',
            'Abra as ferramentas de desenvolvedor: F12 ou Ctrl+Shift+I (no Mac, Cmd+Option+I). Vá na aba Rede (Network) e recarregue a página.',
            'No filtro da aba Rede, digite browse e clique em uma das requisições. Em Cabeçalhos da requisição (Request Headers), copie o valor de Cookie inteiro.',
            'Mais fácil: clique com o botão direito na requisição e use Copiar > Copiar como cURL. O painel separa o Cookie sozinho.',
            'Cole abaixo e use Validar e conectar. Se você sair da conta no navegador, o cookie para de valer e é preciso repetir estes passos.',
        ],
        credentialWarning: 'Integração não oficial via cookie. O cookie fica protegido neste computador; não o coloque em logs, commits ou capturas de tela.',
        envSnippet: `YTMUSIC_COOKIE=cole_o_cabecalho_cookie_completo_de_music_youtube_com_aqui
YTMUSIC_AUTH_USER=0`,
    },
    deezer: {
        label: 'Deezer',
        tone: 'neutral',
        buttonVariant: 'secondary',
        accentGradient: 'via-[#A238FF]',
        description: 'Origem ou destino. Playlists públicas e a busca funcionam sem login pela API aberta do Deezer, com busca exata por ISRC. Para listar suas playlists, ler privadas e criar playlists, cole o cookie arl.',
        createdVisibility: 'Visibilidade: privada.',
        setupSteps: [
            'Sem nada configurado: cole o link de uma playlist pública do Deezer como origem.',
            'Para usar como destino: abra deezer.com logado e as ferramentas de desenvolvedor (F12 ou Ctrl+Shift+I; no Mac, Cmd+Option+I). Na aba Aplicativo (Application), ou Armazenamento no Firefox, abra Cookies > https://www.deezer.com.',
            'Copie o valor do cookie "arl" (texto hexadecimal longo) e cole abaixo.',
        ],
        credentialWarning: 'O arl dá acesso à sua conta Deezer. Fica protegido neste computador; não compartilhe nem coloque em logs ou capturas de tela.',
        envSnippet: 'DEEZER_ARL=cole_o_cookie_arl_de_deezer_com_aqui',
    },
    tidal: {
        label: 'TIDAL',
        tone: 'neutral',
        buttonVariant: 'inverse',
        accentGradient: 'via-cyan-300',
        description: 'Origem ou destino pela API oficial do TIDAL (OAuth + PKCE), com busca exata por ISRC. Playlists criadas ficam como "não listadas": só abre quem tiver o link.',
        createdVisibility: 'Visibilidade: não listada (só abre quem tiver o link).',
        setupSteps: [
            'Abra developer.tidal.com, entre na sua conta e crie um aplicativo.',
            'Cadastre no aplicativo o endereço de retorno mostrado abaixo. Copie o Client ID e salve neste painel.',
            'A leitura e a escrita da sua conta precisam de autorização. A criação de playlists ainda está em validação experimental.',
            'Clique em Conectar TIDAL, autorize no navegador e volte à migração.',
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
        createdVisibility: 'A playlist fica na sua biblioteca do Apple Music.',
        setupSteps: [
            'Sem nada configurado: cole o link de uma playlist pública do Apple Music como origem.',
            'Oficial: com conta Apple Developer, crie uma chave MusicKit, defina APPLE_TEAM_ID, APPLE_KEY_ID e APPLE_PRIVATE_KEY_PATH no backend/.env e use "Conectar com Apple Music".',
            'Sem conta de desenvolvedor: abra music.apple.com logado e as ferramentas de desenvolvedor (F12 ou Ctrl+Shift+I; no Mac, Cmd+Option+I). Em Aplicativo (Application) > Cookies, copie o valor de "media-user-token".',
        ],
        credentialWarning: 'O Music User Token dá acesso à sua biblioteca. Fica protegido neste computador; não compartilhe.',
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
        createdVisibility: 'Visibilidade: privada.',
        setupSteps: [
            'Sem nada configurado: cole o link de uma playlist (set) pública do SoundCloud como origem.',
            'Para usar como destino: abra soundcloud.com logado e as ferramentas de desenvolvedor (F12 ou Ctrl+Shift+I; no Mac, Cmd+Option+I). Em Aplicativo (Application) > Cookies, copie o valor de "oauth_token".',
            'A API oficial só libera credenciais para contas Artist Pro; por isso a integração usa a sessão do site (não oficial).',
        ],
        credentialWarning: 'O oauth_token dá acesso à sua conta SoundCloud. Fica protegido neste computador; não compartilhe.',
        envSnippet: 'SOUNDCLOUD_OAUTH_TOKEN=cole_o_cookie_oauth_token_aqui',
    },
    file: {
        label: 'Arquivo',
        tone: 'neutral',
        buttonVariant: 'secondary',
        accentGradient: 'via-sky-300',
        description: 'Ponte para qualquer app: importe CSV (Exportify e outros), JSON, M3U/M3U8 ou TXT como origem, ou gere um arquivo como destino.',
        setupSteps: [
            'Como origem: escolha Arquivo na aba Início e clique em "Importar arquivo" ou arraste o arquivo para a lista.',
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

export const getProviderUi = (providerId) => {
    const value = PROVIDER_UI[providerId] || { ...GENERIC_UI, label: providerId };
    return { ...value, label: translate(value.label), description: translate(value.description), setupSteps: value.setupSteps.map((step) => translate(step)), credentialWarning: translate(value.credentialWarning), createdVisibility: translate(value.createdVisibility) };
};

export const getProviderLabel = (providerId, providers = []) => translate(
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
