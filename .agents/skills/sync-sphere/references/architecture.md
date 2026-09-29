# Referência de Arquitetura do SyncSphere

SyncSphere migra playlists entre Spotify e YouTube Music. É local-first single-user: sem contas, sem banco de dados e sem Redis. Dados em arquivos cifrados (`backend/data/`) e fila local persistida.

Back-end:

- `backend/src/server.js`: dotenv, servidor HTTP, Socket.io e inicialização do trabalhador.
- `backend/src/app.js`: app Express, middleware de segurança, CORS, JSON, cookies, limite de taxa, rotas e tratamento de erros.
- `backend/src/socket/transferSocket.js`: registra o usuário local no socket e inscrição em salas de transferência.
- `backend/src/controllers`: orquestração HTTP.
- `backend/src/services`: serviços de negócio reutilizáveis.
- `backend/src/services/queueService.js`: fila de transferências persistida em `data/queue.json`, com reagendamento (`rescheduleAt`).
- `backend/src/errors/providerErrors.js`: classificação de erros das plataformas (`rate_limited`, `auth`, `transient`, `not_found`, `permanent`).
- `backend/src/services/spotify`: autenticação Spotify, cliente HTTP, erros e formatadores usados por `spotifyService.js`.
- `backend/src/services/youtubeMusic`: autenticação por cookie do YouTube Music e pontuação de correspondência usadas por `youtubeMusicService.js`.
- `backend/src/services/transfer`: casos de uso de transferência, processador do trabalhador, estado por faixa (`TransferTrackStore`), métricas/ETA (`TransferMetrics`), ações de fila (`transferQueueActions`), snapshots de progresso, repositório e correspondência.
- `backend/src/storage`: armazenamento local em arquivos JSON cifrados.
- `backend/src/workers`: registra o processador da fila local.
- `backend/src/models`: acesso aos dados locais (`User` = usuário local, `Transfer` = histórico).
- `backend/src/schemas`: validação Zod.

Front-end:

- `frontend/src/App.jsx`: rotas e carregamento global (sem login; `/login` redireciona ao painel).
- `frontend/src/services/api.js`: Axios base client, `withCredentials`.
- `frontend/src/store/useAuthStore.js`: usuário local fixo.
- `frontend/src/components/dashboard`: abas do painel.
- `frontend/src/components/dashboard/home`: subcomponentes da aba Início.
- `frontend/src/components/layout`: estrutura do app.

Preserve:

- modelo local-first: sem MongoDB, Redis, contas ou login.
- Axios `withCredentials` para o OAuth do Spotify.
- fila local para transferências longas.
- Socket.io para progresso.
- credenciais de terceiros criptografadas; nunca versionar `backend/data/`.
- UI escura em Tailwind com `spotify`, `youtube`, `darkBackground`, `surfaceCard`.

Checagem de alinhamento conhecida:

- o `.env.example` do back-end usa `PORT=8000` por padrão;
- a alternativa do Axios usa `/api/v1` no app servido pelo back-end e `http://localhost:8000/api/v1` no Vite;
- defina `VITE_API_URL` ao testar uma URL de back-end fora do padrão.
