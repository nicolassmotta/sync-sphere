export const localSetupFlow = [
    {
        title: 'Configurar aplicação local',
        description: 'Instale dependências, copie o `.env.example`, gere o build React e rode tudo em `localhost:8000`. Os dados ficam em arquivos locais cifrados; não precisa de banco nem Redis.',
    },
    {
        title: 'Configurar Spotify OAuth',
        description: 'Crie um app no painel do Spotify e use o callback local com escopos de leitura e escrita.',
    },
    {
        title: 'Configurar YTMUSIC_COOKIE',
        description: 'Cole no back-end apenas o cabeçalho Cookie completo de uma sessão sua em music.youtube.com.',
    },
    {
        title: 'Validar integrações',
        description: 'Use os status do painel e os endpoints `/api/health`, `/api/ready` e `/integrations/status`.',
    },
    {
        title: 'Escolher playlists',
        description: 'Escolha a direção, carregue playlists do Spotify ou cole link/ID do YouTube Music.',
    },
    {
        title: 'Iniciar migração',
        description: 'O back-end cria registros de transferência e envia tarefas para a fila local em memória.',
    },
    {
        title: 'Acompanhar progresso e histórico',
        description: 'Socket.io atualiza a migração ativa; o histórico mostra direção, sucesso, falhas e links criados.',
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
        text: 'Preencha `YTMUSIC_COOKIE`, reinicie o back-end e use o botão de atualizar status. Nunca cole cookies reais em docs, commits ou issues.',
    },
    {
        title: 'Dados locais e histórico',
        text: 'Credenciais e histórico ficam cifrados em `backend/data/` (ignorado pelo Git). Para limpar o histórico, rode `npm run history:clear` no back-end.',
    },
];
