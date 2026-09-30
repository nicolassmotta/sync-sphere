# Contexto do Projeto SyncSphere

## Produto

SyncSphere migra playlists entre Spotify e YouTube Music. É open-source **self-hosted single-user**: a pessoa clona, configura suas credenciais e usa localmente. Não há contas, login nem banco de dados. A experiência é:

1. usuário roda o projeto localmente;
2. abre `http://localhost:8000`, servido pelo back-end depois do build do front-end;
3. valida o back-end pelo front-end ou por `/api/health` e `/api/ready`;
4. configura Spotify OAuth no back-end;
5. configura `YTMUSIC_COOKIE` no back-end;
6. valida integrações no painel;
7. escolhe a direção Spotify -> YouTube Music ou YouTube Music -> Spotify;
8. conecta Spotify via OAuth ou cola uma playlist;
9. escolhe uma ou várias playlists do Spotify, ou informa link/ID do YouTube Music;
10. back-end cria uma transferência por playlist e envia os trabalhos para a fila local;
11. trabalhador busca correspondências no destino e cria a playlist privada;
12. painel mostra progresso, histórico, direção e falhas de correspondência.

## Arquitetura Atual

### Raiz

- `package.json`: scripts de conveniência para open-source local. `npm run setup` instala back-end/front-end e gera `frontend/dist`; `npm start` sobe o back-end, que serve API, Socket.io e React em `http://localhost:8000`.

### Back-end

Diretório: `backend/`

- Execução: Node.js com ESM.
- Framework: Express.
- Persistência: arquivos JSON cifrados em `backend/data/` (sem banco de dados).
- Fila: no próprio processo, persistida em `data/queue.json` (sem Redis/BullMQ). Transferências não concluídas voltam para a fila no boot.
- Tempo real: Socket.io acoplado ao servidor HTTP.
- Autenticação: nenhuma. Existe um único usuário local implícito (`LOCAL_USER_ID = 'local'`), o dono da máquina.
- Segurança: Helmet, CORS com credenciais, rate limit, Zod e criptografia das credenciais persistidas.

Mapa de arquivos:

- `src/server.js`: carrega `.env`, cria servidor HTTP, registra Socket.io e inicia o trabalhador.
- `src/app.js`: middlewares globais, rotas HTTP, fallback estático para `frontend/dist` e tratadores de erro.
- `src/socket/transferSocket.js`: registra o usuário local no socket e controla inscrição em salas de transferência.
- `src/routes/`: roteamento HTTP.
- `src/controllers/`: entrada HTTP e orquestração imediata.
- `src/providers/`: adaptadores de plataforma (`spotify/`, `youtubeMusic/`, `deezer/`, `tidal/`, `appleMusic/`, `soundcloud/`, `file/`) e `registry.js`, que documenta o contrato. Todo fluxo de integração e transferência passa pelo registro; não chame `spotifyService`/`youtubeMusicService` direto de controllers ou do processador.
- `src/modules/integrations/`: `providerIntegrationController.js` (rotas genéricas `/integrations/:provider/...`) e utilitários de OAuth.
- `src/models/`: acesso aos dados locais. `User.js` é o único usuário local (guarda tokens do Spotify); `Transfer.js` é o histórico. Ambos mantêm a API estilo Mongoose (`findById`, `find`, `insertMany`, `.save()`) sobre o storage local.
- `src/storage/jsonStore.js`: leitura/escrita de arquivos JSON cifrados em `DATA_DIR`.
- `src/storage/credentialStore.js`: credenciais coladas no painel (ex.: cookie do YouTube Music) em `data/provider-credentials.json`.
- `src/schemas/`: schemas Zod.
- `src/services/`: serviços reutilizáveis, como a fila local e integrações externas.
- `src/services/queueService.js`: fila de transferências persistida (`addTransferJob`, `registerTransferProcessor`, `runTransferNow`, `getQueuePosition`), com uma raia (`lane`) por plataforma de destino. O processador pode devolver `{ rescheduleAt }` para o job voltar mais tarde.
- `src/services/spotify/`: autenticação/token, cliente HTTP, erros, normalizadores e pontuação Spotify usados pela fachada `spotifyService.js`.
- `src/services/youtubeMusic/`: autenticação por cookie, leitura/criação de playlist e pontuação de correspondência usados pela fachada `youtubeMusicService.js`.
- `src/services/transfer/TransferProcessor.js`: orquestra a migração para qualquer par origem/destino a partir do registro de provedores.
- `src/services/transfer/startTransferService.js`: caso de uso HTTP para criar transferências e enfileirar tarefas.
- `src/services/transfer/TrackMatcher.js`: executa correspondência faixa a faixa.
- `src/services/matching/MatchCache.js`: correspondências confiáveis compartilhadas entre transferências, em `data/match-cache.json` cifrado. Validade de sete dias, limite de 5.000 entradas, isolamento por destino e contexto de catálogo. Não guarda falhas nem resultados abaixo da confiança mínima. Acertos pulam busca e atraso, sem alterar a média de latência externa. Destino Arquivo não usa cache.
- `src/services/transfer/manualMatchService.js`: revisão manual de `not_found` e `failed` em transferências terminadas. Busca por título/artista ajustados, sem ISRC da origem; guarda proposta com UUID e validade de dez minutos. Confirmação aceita apenas o UUID persistido, marca a faixa como `matched`/`manual` e reenfileira para inserção. Bloqueia revisão concorrente ou com job existente. Rotas `POST /transfer/:transferId/tracks/:trackIndex/search` e `/confirm`, com validação Zod.
- `src/services/transfer/ProgressPublisher.js`: publica eventos Socket.io por transferência.
- `src/services/transfer/TransferRepository.js`: encapsula leitura/escrita de transferência e usuário para tarefas.
- `src/services/transfer/transferProgressSnapshot.js`: calcula snapshot inicial de progresso usado no Socket.io.
- `src/workers/`: registra o processador da fila local.
- `src/config/`: `paths.js` (DATA_DIR e `FRONTEND_DIST_DIR`), CORS e carregamento de ambiente.
- `src/utils/`: logger, criptografia (chave em env ou auto-gerada em `data/encryption.key`) e erro customizado.
- `src/errors/UnrecoverableError.js`: erro que sinaliza falha definitiva (a fila não tenta novamente).
- `src/errors/providerErrors.js`: `classifyProviderError` (`rate_limited`, `auth`, `transient`, `not_found`, `permanent`), `TransferPausedError` e `TransferNeedsAuthError`.
- `src/services/transfer/TransferTrackStore.js`: estado por faixa em `data/transfer-tracks-<id>.json` (`pending`, `matched`, `not_found`, `retry_queued`, `failed`).
- `src/services/transfer/TransferMetrics.js`: média móvel do tempo de busca/inserção, ETA e estatísticas por plataforma em `data/provider-stats.json`.
- `src/services/transfer/transferQueueActions.js`: retry de pendências, retomada manual, retomada após reconectar e recuperação no boot.

### Front-end

Diretório: `frontend/`

- Execução/build: Vite.
- UI: React 18.
- Roteamento: React Router.
- Estado global: Zustand.
- HTTP: Axios com `withCredentials`.
- Visual: TailwindCSS, dark UI, glassmorphism, Framer Motion, Lucide.

Mapa de arquivos:

- `src/App.jsx`: rotas, carregamento global e toaster. O painel abre direto, sem login; `/login` redireciona para `/dashboard`.
- `src/services/api.js`: cliente Axios.
- `src/store/useAuthStore.js`: usuário local fixo (sem login).
- `src/pages/`: página inicial, painel e 404.
- `src/components/dashboard/`: abas e fluxo principal.
- `src/components/dashboard/home/`: componentes menores do fluxo da HomeTab, como seleção de direção, playlists, modal de confirmação e cards laterais.
- `src/components/setup/`: tutorial local, checklist de configuração e snippets copiáveis usados na página inicial, Início e Guia local.
- `src/components/layout/`: estrutura do painel.
- `src/components/ui/`: componentes compartilhados.
- `src/hooks/`: lógica reutilizável do painel, como status de integrações, status local do back-end, Socket.io de transferência e início de transferência.
- `src/constants/`: constantes compartilhadas da UI, como abas do painel.
- `docs/ai/ui-components.md`: guia de componentes reutilizáveis, propriedades e exemplos.

## Portas e Variáveis

Back-end `.env.example`:

- `PORT=8000`
- `FRONTEND_URL=http://localhost:8000`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_REDIRECT_URI=http://127.0.0.1:8000/api/v1/integrations/spotify/callback`
- Spotify OAuth usa Authorization Code + PKCE, sem `SPOTIFY_CLIENT_SECRET`, com escopos de leitura e escrita (`playlist-read-*`, `playlist-modify-*`, `user-read-private`) para suportar YouTube Music -> Spotify.
- `YTMUSIC_COOKIE`
- `YTMUSIC_AUTH_USER` opcional
- `YT_MUSIC_SEARCH_DELAY_MS=750`
- `ENCRYPTION_KEY` opcional (64 caracteres hex; se ausente, gerada em `data/encryption.key`)
- `DATA_DIR` opcional (padrão `backend/data`)

A alternativa atual do front-end em `frontend/src/services/api.js` usa `/api/v1` quando o React é servido pelo back-end e tenta `http://localhost:8000/api/v1` quando roda no Vite. Mantém `http://localhost:4001/api/v1` apenas como fallback técnico para ambientes locais antigos.

## Padrões de Trabalho

- Back-end deve retornar JSON limpo, sem rastro de erro para cliente.
- Controllers devem passar erros para o middleware global e permanecer finos; regras de transferência devem ficar em serviços.
- Integrações devem preferir `src/modules/integrations/controllers/*` por provedor em vez de concentrar OAuth/status em um controller único.
- Use `AppError` para erros esperados de negócio.
- Use Zod antes de controllers para entradas sensíveis.
- Armazene credenciais externas criptografadas (via `storage/jsonStore.js`).
- Rotas de integração são genéricas: `GET /integrations/status` (lista `providers` com capacidades e o mapa `integrations`), `GET /integrations/:provider/login` e `/callback` (OAuth), `PUT /integrations/:provider/credentials` (cookie/token), `DELETE /integrations/:provider`, `GET /integrations/:provider/playlists`, `GET /integrations/:provider/playlists/:playlistId/tracks` e `GET /integrations/:provider/playlist-tracks?playlistId=`.
- `POST /transfer/start` aceita `sourceProvider` e `targetProvider`; `direction` antigo continua aceito.
- Use `/api/health` para back-end online/offline e `/api/ready` para prontidão (retorna `storage` e `queue`).
- YouTube Music usa cookie (colado no painel ou `YTMUSIC_COOKIE`) como origem ou destino; Google OAuth e YouTube Data API foram removidos do fluxo.
- Spotify OAuth atua como origem e destino. Para destino Spotify, a conta precisa ser reconectada se o token antigo não tiver escopos de escrita.
- Use `/api/v1/transfer` para listar o histórico local.
- Evite logar tokens, cookies ou chaves.
- Fluxos do painel devem preferir hooks reutilizáveis em `src/hooks/` antes de concentrar efeitos colaterais em páginas.
- UI nova deve preferir primitivas em `src/components/ui/` (`Button`, `TextField`, `Modal`, `EmptyState`, `Card`) para preservar acessibilidade e consistência.
- Alterações visuais devem respeitar a linguagem escura atual e os tokens Tailwind, com tom utilitário/de código aberto em vez de produto pago ou marketing.
- Tutorial local no front-end deve usar valores demonstrativos para segredos e comandos copiáveis alinhados ao README.

## Decisões Que Devem Ser Preservadas

- Modelo local-first single-user: não reintroduzir MongoDB, Redis, contas ou login. A aplicação deve subir sem dependência de infraestrutura externa.
- Persistência local em arquivos cifrados; nunca versionar `backend/data/`.
- Transferências longas não devem bloquear HTTP; sempre usar a fila local + trabalhador.
- Progresso de transferência deve ser emitido em tempo real por Socket.io.
- `withCredentials` deve ser mantido no Axios para o fluxo de OAuth do Spotify.
- Integrações externas precisam prever rate limit, falhas parciais e logs de músicas não encontradas.
