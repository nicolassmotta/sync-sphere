# Referência de Arquitetura do SyncSphere

SyncSphere migra playlists do Spotify para o YouTube Music.

Back-end:

- `backend/src/server.js`: dotenv, conexão Mongo, servidor HTTP, Socket.io e inicialização do trabalhador.
- `backend/src/app.js`: app Express, middleware de segurança, CORS, JSON, cookies, limite de taxa, rotas e tratamento de erros.
- `backend/src/socket/transferSocket.js`: autenticação Socket.io e inscrição em salas de transferência.
- `backend/src/controllers`: orquestração HTTP.
- `backend/src/services`: serviços de negócio reutilizáveis.
- `backend/src/services/spotify`: autenticação Spotify, cliente HTTP, erros e formatadores usados por `spotifyService.js`.
- `backend/src/services/youtubeMusic`: autenticação por cookie do YouTube Music e pontuação de correspondência usadas por `youtubeMusicService.js`.
- `backend/src/services/transfer`: casos de uso de transferência, processador do trabalhador, snapshots de progresso, repositório e correspondência.
- `backend/src/workers`: processamento BullMQ em segundo plano.
- `backend/src/models`: documentos Mongoose.
- `backend/src/schemas`: validação Zod.

Front-end:

- `frontend/src/App.jsx`: rotas, rota privada, verificação de autenticação e carregamento global.
- `frontend/src/services/api.js`: Axios base client, `withCredentials`.
- `frontend/src/store/useAuthStore.js`: estado de sessão.
- `frontend/src/components/dashboard`: abas do painel.
- `frontend/src/components/dashboard/home`: subcomponentes da aba Início.
- `frontend/src/components/layout`: estrutura do app.

Preserve:

- JWT em cookie HttpOnly.
- Axios `withCredentials`.
- BullMQ para transferências longas.
- Socket.io para progresso.
- credenciais de terceiros criptografadas.
- UI escura em Tailwind com `spotify`, `youtube`, `darkBackground`, `surfaceCard`.

Checagem de alinhamento conhecida:

- o `.env.example` do back-end usa `PORT=4001` por padrão;
- a alternativa do Axios no front-end tenta primeiro `http://localhost:4001/api/v1`;
- defina `VITE_API_URL` ao testar uma URL de back-end fora do padrão.
