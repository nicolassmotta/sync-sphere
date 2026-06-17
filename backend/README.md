# SyncSphere - Back-end (API e Fila Local)

O coração do SyncSphere. Esta aplicação Express.js lida com a lógica de migração bidirecional entre Spotify e YouTube Music sem exigir serviços externos.

É **local-first single-user**: não há contas, login nem banco de dados. As credenciais e o histórico ficam em arquivos JSON cifrados em `backend/data/`, e as transferências rodam em uma fila em memória no próprio processo.

## Padrão de Arquitetura

Utilizamos uma arquitetura adaptada de MVC e código limpo:

- `src/controllers/`: recebe as entradas HTTP e delega regras de negócio.
- `src/models/`: acesso aos dados locais. `User.js` representa o único usuário local e guarda os tokens do Spotify; `Transfer.js` é o histórico de transferências. Ambos persistem via `src/storage/`.
- `src/storage/`: armazenamento local em arquivos JSON cifrados (`jsonStore.js`).
- `src/middlewares/`: tratamento de erros, validação e usuário local.
- `src/services/queueService.js`: fila de transferências em memória (sem Redis).
- `src/workers/`: registra o processador da fila local.

## Configuração de Desenvolvimento Inicial

1. **Instale as dependências:**

   ```bash
   cd backend
   npm install
   ```

2. **Crie suas credenciais base (`.env`):**

   Copie `.env.example` para `.env` e preencha:

   ```dotenv
   NODE_ENV=development
   APP_ENV=dev
   PORT=8000
   FRONTEND_URL=http://localhost:8000

   SPOTIFY_CLIENT_ID=seu_client_id_spotify
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:8000/api/v1/integrations/spotify/callback

   YTMUSIC_COOKIE=cole_o_cabecalho_cookie_completo_de_music_youtube_com_aqui
   # YTMUSIC_AUTH_USER=0
   # YOUTUBE_MUSIC_GL=BR
   # YOUTUBE_MUSIC_HL=pt-BR
   # YTMUSIC_ADD_CHUNK_SIZE=100

   WORKER_ENABLED=true
   YT_MUSIC_SEARCH_DELAY_MS=750
   YOUTUBE_SEARCH_CONCURRENCY=1

   # ENCRYPTION_KEY=
   # DATA_DIR=
   ```

   Não é necessário subir nenhum serviço externo (sem MongoDB e sem Redis).

3. **Ligue o servidor local:**

   ```bash
   npm run dev
   ```

   Na primeira execução, a pasta `data/` é criada com a chave de criptografia. Os dados locais (`data/`) são ignorados pelo Git.

   Para o uso local empacotado, rode `npm run setup` na raiz do repositório e depois `npm start`. Nesse modo, o Express serve a API, o Socket.io e o build React em `http://localhost:8000`.

## Spotify OAuth Gratuito

1. Abra o painel em `https://developer.spotify.com/dashboard` e faça login.
2. Clique em `Create app`.
3. Em `Redirect URIs`, adicione `http://127.0.0.1:8000/api/v1/integrations/spotify/callback`.
4. Copie o `Client ID` para o arquivo `backend/.env`.
5. Reinicie o back-end e clique em `Conectar Spotify` na central de integrações.
6. Reconecte contas já autorizadas antes desta versão para conceder `playlist-modify-private`/`playlist-modify-public`, usados no fluxo YouTube Music -> Spotify.

O fluxo usa Authorization Code + PKCE, então não há `SPOTIFY_CLIENT_SECRET`.

## YouTube Music via Cookie

1. Abra `https://music.youtube.com` no navegador e entre na conta usada como origem ou destino.
2. Copie o cabeçalho `Cookie` completo de uma requisição autenticada para `music.youtube.com`.
3. Cole o valor em `YTMUSIC_COOKIE` no `backend/.env`.
4. Reinicie o back-end.

Observações:

- Nunca publique cookies reais em issues, logs, commits ou capturas de tela.
- O cookie pode expirar ou quebrar se o YouTube Music alterar endpoints internos.

## Dados Locais

- `data/credentials.json`: tokens do Spotify, cifrados.
- `data/transfers.json`: histórico de transferências.
- `data/encryption.key`: chave de criptografia gerada automaticamente (se `ENCRYPTION_KEY` não estiver no `.env`).
- Limpar o histórico de transferências: `npm run history:clear`.

## Testes Automatizados

```bash
npm install
npm test
```

Observações:

- Os testes usam `NODE_ENV=test` e variáveis mínimas definidas em `tests/setupEnv.js` (não precisam de `.env`, banco ou Redis).
- Endpoint de vitalidade: `GET /api/health`.
- Endpoint de prontidão: `GET /api/ready` (retorna `storage` e `queue`).
