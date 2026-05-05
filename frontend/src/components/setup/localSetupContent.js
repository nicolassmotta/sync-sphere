export const localSetupFlow = [
    {
        title: 'Configurar back-end',
        description: 'Instale dependências, copie o `.env.example` e rode a API Express em `localhost:4001`.',
    },
    {
        title: 'Subir MongoDB e Redis',
        description: 'Mongo persiste usuários/transferências; Redis mantém a fila BullMQ e o trabalhador.',
    },
    {
        title: 'Configurar Spotify OAuth',
        description: 'Crie um app no painel do Spotify e use o callback local do SyncSphere.',
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
        description: 'Conecte Spotify, carregue playlists e marque uma ou várias origens.',
    },
    {
        title: 'Iniciar migração',
        description: 'O back-end cria registros de transferência e envia tarefas para BullMQ.',
    },
    {
        title: 'Acompanhar progresso e histórico',
        description: 'Socket.io atualiza a migração ativa; o histórico mostra sucesso, falhas e links criados.',
    },
];

export const setupSnippets = [
    {
        title: 'Back-end local',
        description: 'Execute em um terminal dedicado.',
        label: 'backend',
        code: `cd backend
npm install
cp .env.example .env
npm run dev`,
    },
    {
        title: 'Serviços locais',
        description: 'Use serviços já instalados na máquina e valide a conexão pelo back-end.',
        label: 'mongo redis',
        code: `mongod --dbpath ./data/mongo
redis-server
curl http://localhost:4001/api/ready`,
    },
    {
        title: 'Spotify OAuth',
        description: 'Valores de exemplo para `backend/.env`; nunca publique seus segredos.',
        label: 'backend/.env',
        language: 'env',
        code: `SPOTIFY_CLIENT_ID=seu_client_id_spotify
SPOTIFY_CLIENT_SECRET=seu_client_secret_spotify
SPOTIFY_REDIRECT_URI=http://localhost:4001/api/v1/integrations/spotify/callback`,
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
        title: 'Front-end local',
        description: 'Execute depois do back-end responder em `localhost:4001`.',
        label: 'frontend',
        code: `cd frontend
npm install
npm run dev`,
    },
    {
        title: 'Validação rápida',
        description: 'Confirme back-end, dependências e API base antes de migrar playlists.',
        label: 'checagens',
        code: `curl http://localhost:4001/api/health
curl http://localhost:4001/api/ready`,
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
        href: 'http://localhost:4001/api/health',
    },
];

export const troubleshootingItems = [
    {
        title: 'Front-end não conecta no back-end',
        text: 'Confirme `VITE_API_URL=http://localhost:4001/api/v1`, `FRONTEND_URL=http://localhost:5173` e se o back-end subiu sem erro.',
    },
    {
        title: 'Spotify volta para erro ou tela negada',
        text: 'Revise `SPOTIFY_REDIRECT_URI` no `.env` e no painel do Spotify. O callback precisa bater exatamente.',
    },
    {
        title: 'YouTube Music aparece como pendente',
        text: 'Preencha `YTMUSIC_COOKIE`, reinicie o back-end e use o botão de atualizar status. Nunca cole cookies reais em docs, commits ou issues.',
    },
    {
        title: 'Mongo ou Redis caem no `/api/ready`',
        text: 'Inicie os serviços locais e reinicie o back-end para reconectar Mongoose e BullMQ.',
    },
];
