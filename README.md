# SyncSphere

SyncSphere é um migrador local e de código aberto de playlists do Spotify para o YouTube Music. Ele combina back-end Express, MongoDB, Redis/BullMQ, Socket.io e front-end React para guiar a configuração, escolher playlists, iniciar migrações e acompanhar histórico.

O escopo atual é local, com dependências explícitas e sem camada comercial.

## Fluxo Local

1. Configure o back-end.
2. Suba MongoDB e Redis.
3. Configure Spotify OAuth.
4. Configure `YTMUSIC_COOKIE`.
5. Valide integrações no painel.
6. Escolha uma ou mais playlists.
7. Inicie a migração.
8. Acompanhe progresso e histórico.

## Arquitetura

- `backend/`: Node.js + Express em ESM, MongoDB/Mongoose, Redis/BullMQ, Socket.io, JWT em cookie HttpOnly e Zod.
- `frontend/`: React 18 + Vite, React Router, Zustand, Axios com `withCredentials`, TailwindCSS, Framer Motion e Lucide.
- `docs/ai/`: contexto operacional para agentes e decisões recorrentes do projeto.
- `.agents/skills/sync-sphere/`: skill local usada por agentes que trabalham neste repositório.

## Requisitos

- Node.js 20+
- MongoDB local acessível por `mongodb://localhost:27017/syncsphere`
- Redis local acessível por `127.0.0.1:6379`
- App Spotify com OAuth configurado
- cookie do YouTube Music em `YTMUSIC_COOKIE`

## 1. Back-end

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Variáveis principais em `backend/.env`:

```env
PORT=4001
FRONTEND_URL=http://localhost:5173
JWT_SECRET=troque_este_valor_localmente
# Gere um valor real com:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
MONGO_URI=mongodb://localhost:27017/syncsphere
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
SPOTIFY_CLIENT_ID=seu_client_id_spotify
SPOTIFY_CLIENT_SECRET=seu_client_secret_spotify
SPOTIFY_REDIRECT_URI=http://localhost:4001/api/v1/integrations/spotify/callback
YTMUSIC_COOKIE=cole_o_cabecalho_cookie_completo_de_music_youtube_com_aqui
```

Nunca publique `SPOTIFY_CLIENT_SECRET`, `JWT_SECRET`, `ENCRYPTION_KEY` ou `YTMUSIC_COOKIE`.

## 2. MongoDB e Redis

Use os serviços locais já instalados na sua máquina. Depois valide:

```bash
curl http://localhost:4001/api/health
curl http://localhost:4001/api/ready
```

`/api/ready` deve retornar `mongo: "up"` e `redis: "up"` antes de iniciar uma migração.

## 3. Spotify OAuth

No painel de desenvolvedores do Spotify:

- crie ou abra um app;
- configure a URI de redirecionamento exatamente como `http://localhost:4001/api/v1/integrations/spotify/callback`;
- copie `SPOTIFY_CLIENT_ID` e `SPOTIFY_CLIENT_SECRET` para `backend/.env`;
- reinicie o back-end;
- conecte pelo painel do SyncSphere em `Integrações`.

## 4. Cookie do YouTube Music

O destino usa `YTMUSIC_COOKIE` no back-end local.

1. Abra `https://music.youtube.com` logado na conta de destino.
2. Abra as ferramentas de desenvolvedor, aba Rede.
3. Clique em uma requisição para `music.youtube.com`.
4. Copie o cabeçalho `Cookie` completo.
5. Cole em `YTMUSIC_COOKIE` no `backend/.env`.
6. Reinicie o back-end e clique em `Revalidar cookie` no painel.

Use apenas valores demonstrativos em issues, docs, commits e capturas de tela.

## 5. Front-end

```bash
cd frontend
npm install
npm run dev
```

Se a API não estiver na porta padrão, configure:

```env
VITE_API_URL=http://localhost:4001/api/v1
```

Portas padrão:

- Front-end: `http://localhost:5173`
- API do back-end: `http://localhost:4001/api/v1`
- Saúde: `http://localhost:4001/api/health`
- Prontidão: `http://localhost:4001/api/ready`

## Painel

O front-end inclui um tutorial embutido:

- Início: checklist de back-end, MongoDB, Redis, Spotify OAuth, `YTMUSIC_COOKIE`, seleção, fila e histórico.
- Integrações: status técnico e ações para conectar Spotify ou revalidar cookie.
- Guia local: comandos copiáveis, variáveis de ambiente e solução de problemas.
- Histórico: transferências concluídas, falhas de correspondência e links criados no YouTube Music.

## Segurança

- O JWT fica em cookie HttpOnly; não use `localStorage` para sessão.
- Axios deve manter `withCredentials`.
- Tokens de integrações são criptografados antes de persistir.
- Transferências longas continuam fora do ciclo HTTP de requisição/resposta, sempre via BullMQ/trabalhador.
- Socket.io publica progresso para o painel.

## Solução de Problemas

- Front-end não conecta: confira `VITE_API_URL`, `FRONTEND_URL`, porta `4001` e CORS.
- `/api/ready` mostra Mongo ou Redis offline: suba o serviço local e reinicie o back-end.
- Spotify OAuth falha: confirme se `SPOTIFY_REDIRECT_URI` é idêntico no `.env` e no painel do Spotify.
- YouTube Music fica pendente: preencha `YTMUSIC_COOKIE`, reinicie o back-end e revalide no painel.
- Playlist não lista faixas: o Spotify pode bloquear playlists sem permissão de leitura; tente outra playlist ou reconecte OAuth.

## Verificação

Back-end:

```bash
cd backend
npm test
```

Front-end:

```bash
cd frontend
npm run lint
npm run build
```

## Licença

MIT. Veja `LICENSE`.

## Contexto para Agentes

Agentes devem começar por `AGENTS.md` e, quando precisarem de mais contexto, consultar `docs/ai/project-context.md`, `docs/ai/agent-tooling.md` e `docs/ai/skill-policy.md`.

Regra prática: se uma decisão arquitetural precisar ser repetida para outro agente, registre em `docs/ai/`.
