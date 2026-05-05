# Contexto do Projeto SyncSphere

## Produto

SyncSphere migra playlists do Spotify para o YouTube Music. A experiência de código aberto em refatoração é:

1. usuário roda o projeto localmente;
2. valida back-end, MongoDB e Redis pelo front-end ou por `/api/health` e `/api/ready`;
3. configura Spotify OAuth no back-end;
4. configura `YTMUSIC_COOKIE` no back-end;
5. valida integrações no painel;
6. conecta Spotify via OAuth ou cola uma playlist;
7. escolhe uma ou várias playlists;
8. back-end cria uma transferência por playlist e envia os trabalhos para fila;
9. trabalhador busca correspondências via YouTube Music e cria a playlist via cookie;
10. painel mostra progresso, histórico e falhas de correspondência.

## Arquitetura Atual

### Back-end

Diretório: `backend/`

- Execução: Node.js com ESM.
- Framework: Express.
- Banco: MongoDB via Mongoose.
- Fila: Redis + BullMQ.
- Tempo real: Socket.io acoplado ao servidor HTTP.
- Autenticação: JWT em cookie HttpOnly ainda existe, mas está marcado para substituição por fluxo local/anônimo sem conta obrigatória.
- Segurança: Helmet, CORS com credenciais, rate limit, `express-mongo-sanitize`, Zod.

Mapa de arquivos:

- `src/server.js`: carrega `.env`, conecta Mongo, cria servidor HTTP, registra Socket.io e inicia trabalhador.
- `src/app.js`: middlewares globais, rotas HTTP e tratadores de erro.
- `src/socket/transferSocket.js`: autentica sockets via cookie JWT e controla inscrição em salas de transferência.
- `src/routes/`: roteamento HTTP.
- `src/controllers/`: entrada HTTP e orquestração imediata.
- `src/modules/integrations/`: controllers e utilitários específicos das integrações externas, separados por provedor.
- `src/models/`: schemas Mongoose.
- `src/schemas/`: schemas Zod.
- `src/services/`: serviços reutilizáveis, como fila, sessão/autenticação, reset de senha e integrações externas.
- `src/services/spotify/`: autenticação/token, cliente HTTP, erros e normalizadores Spotify usados pela fachada `spotifyService.js`.
- `src/services/youtubeMusic/`: autenticação por cookie e pontuação de correspondência usados pela fachada `youtubeMusicService.js`.
- `src/services/transfer/TransferProcessor.js`: orquestra a tarefa de migração.
- `src/services/transfer/startTransferService.js`: caso de uso HTTP para criar transferências e enfileirar tarefas.
- `src/services/transfer/TrackMatcher.js`: executa correspondência faixa a faixa no YouTube Music.
- `src/services/transfer/ProgressPublisher.js`: publica eventos Socket.io por transferência.
- `src/services/transfer/TransferRepository.js`: encapsula leitura/escrita de transferência e usuário para tarefas.
- `src/services/transfer/transferProgressSnapshot.js`: calcula snapshot inicial de progresso usado no Socket.io.
- `src/workers/`: inicialização dos trabalhadores BullMQ.
- `src/config/`: Mongo, Redis, CORS e carregamento de ambiente.
- `src/utils/`: logger, criptografia e erro customizado.

### Front-end

Diretório: `frontend/`

- Execução/build: Vite.
- UI: React 18.
- Roteamento: React Router.
- Estado global: Zustand.
- HTTP: Axios com `withCredentials`.
- Visual: TailwindCSS, dark UI, glassmorphism, Framer Motion, Lucide.

Mapa de arquivos:

- `src/App.jsx`: rotas, guarda de autenticação, carregamento global e toaster.
- `src/services/api.js`: cliente Axios.
- `src/store/useAuthStore.js`: estado de sessão.
- `src/pages/`: página inicial, login, painel e 404. Login ainda existe durante a transição para fluxo sem conta.
- `src/components/auth/`: login, cadastro e reset, ainda legados durante a transição.
- `src/components/dashboard/`: abas e fluxo principal.
- `src/components/dashboard/home/`: componentes menores do fluxo da HomeTab, como seleção de origem, playlists, modal de confirmação e cards laterais.
- `src/components/setup/`: tutorial local, checklist de configuração e snippets copiáveis usados na página inicial, Início e Guia local.
- `src/components/layout/`: estrutura do painel.
- `src/components/ui/`: componentes compartilhados.
- `src/hooks/`: lógica reutilizável do painel, como status de integrações, status local do back-end, Socket.io de transferência e início de transferência.
- `src/constants/`: constantes compartilhadas da UI, como abas do painel.
- `docs/ai/ui-components.md`: guia de componentes reutilizáveis, propriedades e exemplos.

## Portas e Variáveis

Back-end `.env.example`:

- `PORT=4001`
- `FRONTEND_URL=http://localhost:5173`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `ENCRYPTION_KEY` com 64 caracteres hexadecimais
- `MONGO_URI=mongodb://localhost:27017/syncsphere`
- `REDIS_HOST=127.0.0.1`
- `REDIS_PORT=6379`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI=http://localhost:4001/api/v1/integrations/spotify/callback`
- `YTMUSIC_COOKIE`
- `YTMUSIC_AUTH_USER` opcional
- `YT_MUSIC_SEARCH_DELAY_MS=750`

A alternativa atual do front-end em `frontend/src/services/api.js` tenta primeiro `http://localhost:4001/api/v1`, alinhada ao back-end padrão, e depois `http://localhost:4000/api/v1` para compatibilidade local.

## Padrões de Trabalho

- Back-end deve retornar JSON limpo, sem rastro de erro para cliente.
- Controllers devem passar erros para o middleware global e permanecer finos; regras de sessão, reset e transferência devem ficar em serviços.
- Integrações devem preferir `src/modules/integrations/controllers/*` por provedor em vez de concentrar OAuth/status em um controller único.
- Use `AppError` para erros esperados de negócio.
- Use Zod antes de controllers para entradas sensíveis.
- Armazene credenciais externas criptografadas.
- Use `/api/v1/integrations/status`, `/api/v1/integrations/spotify/login` e `/api/v1/integrations/spotify/playlists` para integrações reais.
- Use `/api/health` para back-end online/offline e `/api/ready` para MongoDB/Redis quando o front-end precisar mostrar checklist técnico.
- O destino principal é YouTube Music via `YTMUSIC_COOKIE`; Google OAuth e YouTube Data API foram removidos do fluxo.
- Use `/api/v1/transfer` para listar histórico real do usuário autenticado.
- Evite logar tokens, cookies, senhas ou chaves.
- Front-end deve tratar sessão pelo back-end/cookie; nada de token em storage.
- Fluxos do painel devem preferir hooks reutilizáveis em `src/hooks/` antes de concentrar efeitos colaterais em páginas.
- UI nova deve preferir primitivas em `src/components/ui/` (`Button`, `TextField`, `Modal`, `EmptyState`, `Card`) para preservar acessibilidade e consistência.
- Alterações visuais devem respeitar a linguagem escura atual e os tokens Tailwind, com tom utilitário/de código aberto em vez de produto pago ou marketing.
- Tutorial local no front-end deve usar valores demonstrativos para segredos e comandos copiáveis alinhados ao README.

## Decisões Que Devem Ser Preservadas

- Transferências longas não devem bloquear HTTP; sempre usar BullMQ/trabalhador.
- Progresso de transferência deve ser emitido em tempo real por Socket.io.
- Enquanto a autenticação local existir, cookies de auth devem ser HttpOnly e `withCredentials` precisa ser mantido no Axios.
- Integrações externas precisam prever rate limit, falhas parciais e logs de músicas não encontradas.
