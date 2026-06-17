# SyncSphere

SyncSphere é um migrador local e de código aberto de playlists entre Spotify e YouTube Music. Ele combina back-end Express, Socket.io e front-end React para guiar a configuração, escolher a direção, iniciar migrações e acompanhar o histórico.

É **self-hosted single-user**: você clona, configura suas credenciais do Spotify e do YouTube Music, e usa na sua própria máquina. Não há contas, login, banco de dados, MongoDB, Redis ou serviços externos. Os dados ficam em arquivos locais cifrados e a fila roda no próprio processo.

## Fluxo Local

1. Instale dependências e gere o build do front-end com `npm run setup`.
2. Configure o back-end (`backend/.env`).
3. Configure Spotify OAuth.
4. Configure `YTMUSIC_COOKIE`.
5. Suba o servidor único com `npm start`.
6. Abra `http://localhost:8000`.
7. Valide integrações no painel.
8. Escolha a direção da transferência.
9. Escolha uma ou mais playlists do Spotify ou cole um link/ID do YouTube Music.
10. Inicie a migração e acompanhe progresso/histórico.

## Arquitetura

- `backend/`: Node.js + Express em ESM, Socket.io, Zod. Persistência local em arquivos JSON cifrados (`backend/data/`) e fila de transferências em memória.
- `frontend/`: React 18 + Vite, React Router, Zustand, Axios com `withCredentials`, TailwindCSS, Framer Motion e Lucide.
- `docs/ai/`: contexto operacional para agentes e decisões recorrentes do projeto.
- `.agents/skills/sync-sphere/`: skill local usada por agentes que trabalham neste repositório.

Sem MongoDB, sem Redis, sem contas: a aplicação sobe sem nenhuma dependência de infraestrutura externa.

## Requisitos

- Node.js 20+
- App Spotify com OAuth configurado para leitura e criação de playlists
- cookie do YouTube Music em `YTMUSIC_COOKIE`

## 1. Uso Local em `localhost:8000`

Na raiz do projeto:

```bash
npm run setup
cp backend/.env.example backend/.env
```

No Windows PowerShell, use:

```powershell
Copy-Item backend/.env.example backend/.env
```

Preencha `backend/.env`, configure o callback do Spotify e inicie:

```bash
npm start
```

Depois abra:

```text
http://localhost:8000
```

O back-end serve a API, o Socket.io e o build React (`frontend/dist`) na mesma porta. Para desenvolvimento da UI com Vite, veja a seção de front-end.

## 2. Back-end

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Variáveis principais em `backend/.env`:

```env
PORT=8000
FRONTEND_URL=http://localhost:8000
SPOTIFY_CLIENT_ID=seu_client_id_spotify
YTMUSIC_COOKIE=cole_o_cabecalho_cookie_completo_de_music_youtube_com_aqui
```

O Spotify usa OAuth Authorization Code + PKCE: configure apenas `SPOTIFY_CLIENT_ID` no `.env`. Não há `SPOTIFY_CLIENT_SECRET`. Se precisar sobrescrever o callback padrão, defina também `SPOTIFY_REDIRECT_URI`.

A chave de criptografia das credenciais locais é gerada automaticamente em `backend/data/encryption.key` na primeira execução. Para fixar uma própria, defina `ENCRYPTION_KEY` (64 caracteres hexadecimais) no `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Nunca publique `ENCRYPTION_KEY` ou `YTMUSIC_COOKIE`. A pasta `backend/data/` é ignorada pelo Git. O Client ID do Spotify não é segredo; com PKCE não há Client Secret.

Valide que o back-end está no ar:

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/ready
```

`/api/ready` retorna `storage: "local"` e `queue: "in-memory"`.

## 3. Spotify OAuth

No painel de desenvolvedores (`https://developer.spotify.com/dashboard`):

- crie ou abra um app;
- em "Redirect URIs", cadastre exatamente `http://127.0.0.1:8000/api/v1/integrations/spotify/callback` (o Spotify exige o IP de loopback `127.0.0.1`, não `localhost`);
- copie o `Client ID` para `SPOTIFY_CLIENT_ID` em `backend/.env` (não precisa de Client Secret);
- reinicie o back-end e conecte pelo painel em `Integrações`;
- reconecte o Spotify se a autorização antiga não incluir `playlist-modify-private`/`playlist-modify-public`, necessárias para YouTube Music -> Spotify.

> Observação: um app Spotify novo nasce em "Development Mode" e só permite até 25 contas adicionadas manualmente no painel. Para liberar para qualquer pessoa, peça o "Extended Quota Mode" na revisão do Spotify.

## 4. Cookie do YouTube Music

YouTube Music usa `YTMUSIC_COOKIE` no back-end local como origem ou destino.

1. Abra `https://music.youtube.com` logado na conta de destino.
2. Abra as ferramentas de desenvolvedor, aba Rede.
3. Clique em uma requisição para `music.youtube.com`.
4. Copie o cabeçalho `Cookie` completo.
5. Cole em `YTMUSIC_COOKIE` no `backend/.env`.
6. Reinicie o back-end e clique em `Revalidar cookie` no painel.

Use apenas valores demonstrativos em issues, docs, commits e capturas de tela.

## 5. Front-end em Desenvolvimento

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Se a API não estiver na porta padrão, configure:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

Portas padrão:

- Aplicação local empacotada: `http://localhost:8000`
- Front-end Vite em desenvolvimento: `http://localhost:5173`
- API do back-end: `http://localhost:8000/api/v1`
- Saúde: `http://localhost:8000/api/health`
- Prontidão: `http://localhost:8000/api/ready`

O painel abre direto, sem tela de login.

## Painel

O front-end inclui um tutorial embutido:

- Início: checklist de back-end, Spotify OAuth, `YTMUSIC_COOKIE`, direção da transferência, seleção, fila e histórico.
- Integrações: status técnico e ações para conectar Spotify ou revalidar cookie.
- Guia local: comandos copiáveis, variáveis de ambiente e solução de problemas.
- Histórico: transferências concluídas, falhas de correspondência, direção usada e links criados no YouTube Music ou Spotify.

## Dados Locais

- Credenciais do Spotify ficam cifradas em `backend/data/credentials.json`.
- O histórico de transferências fica em `backend/data/transfers.json`.
- A chave de criptografia fica em `backend/data/encryption.key` (gerada automaticamente).
- Toda a pasta `backend/data/` é ignorada pelo Git. Para limpar o histórico: `npm run history:clear`.

## Segurança

- Credenciais de integrações são criptografadas antes de persistir.
- Axios mantém `withCredentials`.
- Transferências longas rodam fora do ciclo HTTP, em uma fila no próprio processo.
- Socket.io publica progresso para o painel.
- Como tudo roda local, mantenha `backend/data/` e o `.env` fora de qualquer repositório público.

## Solução de Problemas

- Front-end não conecta: confira `VITE_API_URL`, `FRONTEND_URL`, porta `8000` e CORS.
- Spotify OAuth falha: confirme se `SPOTIFY_CLIENT_ID` está no `.env` e se `SPOTIFY_REDIRECT_URI` é idêntico no `.env` e no painel do Spotify.
- YouTube Music fica pendente: preencha `YTMUSIC_COOKIE`, reinicie o back-end e revalide no painel.
- Playlist não lista faixas: o Spotify pode bloquear playlists sem permissão de leitura; tente outra playlist ou reconecte OAuth.
- YouTube Music -> Spotify falha ao criar destino: reconecte o Spotify para conceder os escopos de escrita.

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
