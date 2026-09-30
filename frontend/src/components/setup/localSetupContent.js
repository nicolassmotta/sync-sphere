export const localSetupFlow = [
    {
        title: 'Configurar aplicação local',
        description: 'Instale dependências, copie o `.env.example`, gere o build React e rode tudo em `localhost:8000`. Os dados ficam em arquivos locais cifrados; não precisa de banco nem Redis.',
    },
    {
        title: 'Conectar as plataformas escolhidas',
        description: 'Abra Integrações e configure apenas os serviços do seu fluxo. Cada plataforma informa seu método de conexão e disponibilidade de leitura pública.',
    },
    {
        title: 'Experimentar sem contas',
        description: 'Escolha Arquivo como origem e destino e importe docs/examples/playlist.csv, incluído no repositório. O Histórico oferece o download em outro formato.',
    },
    {
        title: 'Validar integrações',
        description: 'Use os status do painel e os endpoints `/api/health`, `/api/ready` e `/integrations/status`.',
    },
    {
        title: 'Escolher playlists',
        description: 'Escolha origem e destino. Liste a conta, cole um link/ID ou importe um arquivo, conforme as capacidades da plataforma.',
    },
    {
        title: 'Iniciar migração',
        description: 'O back-end valida a origem e envia tarefas para a fila local persistida. Destinos diferentes podem avançar em paralelo.',
    },
    {
        title: 'Acompanhar progresso e histórico',
        description: 'Acompanhe cada faixa, retome pendências e revise manualmente as músicas não encontradas quando a transferência terminar.',
    },
];

export const setupSnippets = [
    {
        title: 'Aplicação local',
        description: 'Execute na raiz do projeto para instalar, buildar e servir tudo em `localhost:8000`.',
        label: 'raiz',
        code: `npm run setup
cp backend/.env.example backend/.env
# preencha backend/.env
npm start`,
    },
    {
        title: 'Spotify OAuth (PKCE)',
        description: 'Crie um app no painel do Spotify, copie o Client ID e autorize sua conta pelo navegador. O fluxo usa OAuth + PKCE, então não há Client Secret.',
        label: 'backend/.env',
        language: 'env',
        code: `SPOTIFY_CLIENT_ID=seu_client_id_spotify
# Cadastre esta URL exata em "Redirect URIs" no painel do Spotify:
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8000/api/v1/integrations/spotify/callback`,
    },
    {
        title: 'YouTube Music cookie',
        description: 'Valor demonstrativo seguro para `backend/.env`. Cole o cookie real somente no seu ambiente local.',
        label: 'backend/.env',
        language: 'env',
        code: `YTMUSIC_COOKIE=cole_o_cabecalho_cookie_completo_de_music_youtube_com_aqui
YTMUSIC_AUTH_USER=0`,
    },
    {
        title: 'Front-end Vite',
        description: 'Use apenas para desenvolver a UI; o uso normal abre em `localhost:8000`.',
        label: 'frontend',
        code: `cd frontend
npm install
cp .env.example .env
npm run dev`,
    },
    {
        title: 'Validação rápida',
        description: 'Confirme back-end, dependências e API base antes de migrar playlists.',
        label: 'checagens',
        code: `curl http://localhost:8000/api/health
curl http://localhost:8000/api/ready`,
    },
];

export const usefulLinks = [
    {
        label: 'Documentação do SyncSphere',
        href: 'https://github.com/nicolassmotta/sync-sphere/blob/main/docs/README.md',
    },
    {
        label: 'Painel de desenvolvedores do Spotify',
        href: 'https://developer.spotify.com/dashboard',
    },
    {
        label: 'YouTube Music',
        href: 'https://music.youtube.com',
    },
    {
        label: 'Saúde local',
        href: 'http://localhost:8000/api/health',
    },
];

export const troubleshootingItems = [
    {
        title: 'Front-end não conecta no back-end',
        text: 'Confirme `VITE_API_URL=http://localhost:8000/api/v1`, `FRONTEND_URL=http://localhost:8000` e se o back-end subiu sem erro.',
    },
    {
        title: 'Spotify volta para erro ou tela negada',
        text: '`SPOTIFY_CLIENT_ID` precisa estar no `.env` e a URL de callback (`http://127.0.0.1:8000/api/v1/integrations/spotify/callback`) precisa estar idêntica em "Redirect URIs" no painel do Spotify. Para YouTube Music -> Spotify, reconecte se faltar escopo de escrita.',
    },
    {
        title: 'YouTube Music aparece como pendente',
        text: 'Cole o cookie em Integrações (vale na hora) ou preencha `YTMUSIC_COOKIE` e reinicie o back-end. Nunca cole cookies reais em docs, commits ou issues.',
    },
    {
        title: 'Dados locais e histórico',
        text: 'Credenciais e histórico ficam cifrados em `backend/data/` (ignorado pelo Git). Para limpar o histórico, rode `npm run history:clear` no back-end.',
    },
];
