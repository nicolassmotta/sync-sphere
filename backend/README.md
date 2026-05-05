# SyncSphere - Back-end (API e Fila)

O coração do SyncSphere. Esta aplicação Express.js lida com a lógica de conversão massiva de dados sem estrangular a máquina com tarefas em segundo plano.

## Padrão de Arquitetura 
Utilizamos uma arquitetura adaptada de **MVC e código limpo**. As diretrizes de roteamento não se misturam com a lógica de negócio explícita:
- `src/controllers/`: Recebe as ordens de protocolo HTTP.
- `src/models/`: Regras rígidas de esquemas de banco de dados via Mongoose.
- `src/middlewares/`: Protegem requisições, interceptam tokens de autenticação e centralizam o tratamento de erros da API sem vazar rastros de erro para o cliente.
- `src/workers/`: Trabalhadores de fila. Escutam o **Redis / BullMQ** para varrer as plataformas de música por música sem timeout, com alternativas automáticas quando necessário.

## Configuração de Desenvolvimento Inicial

1. **Instale as dependências:**
   ```bash
   cd backend
   npm install
   ```

2. **Crie suas credenciais base (`.env`):**
Crie um arquivo `.env` nesta pasta com a seguinte infraestrutura base:
```dotenv
NODE_ENV=development
APP_ENV=dev
PORT=4001
FRONTEND_URL=http://localhost:5173

# Defina o segredo do cookie de login
JWT_SECRET=troque_este_valor_localmente
JWT_EXPIRES_IN=30d

# Criptografia da aplicação (AES-256; exige exatamente 64 caracteres hexadecimais)
# Valor demonstrativo inseguro para documentar formato. Gere um valor real com:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

# Bancos
MONGO_URI=mongodb://localhost:27017/syncsphere
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Spotify OAuth/API
SPOTIFY_CLIENT_ID=seu_client_id_spotify
SPOTIFY_CLIENT_SECRET=seu_client_secret_spotify
SPOTIFY_REDIRECT_URI=http://localhost:4001/api/v1/integrations/spotify/callback

# Trabalhador
YT_MUSIC_SEARCH_DELAY_MS=750
YOUTUBE_SEARCH_CONCURRENCY=1

# YouTube Music via cookie
YTMUSIC_COOKIE=cole_o_cabecalho_cookie_completo_de_music_youtube_com_aqui
# YTMUSIC_AUTH_USER=0
# YOUTUBE_MUSIC_GL=BR
# YOUTUBE_MUSIC_HL=pt-BR
# YTMUSIC_ADD_CHUNK_SIZE=100
```

3. **Inicie ou certifique-se de que o Redis está ativo:**
   O Redis nativo precisa estar ligado em seu sistema operacional, pois o BullMQ depende dele para salvar etapas e músicas em um banco rápido em memória.
   *`sudo systemctl start redis`* ou rode em um Docker *`docker run -d -p 6379:6379 redis`*

4. **Ligue o servidor local:**
   ```bash
   npm run dev
   ```

## Spotify OAuth Gratuito (Passo a Passo)

1. Abra o painel em `https://developer.spotify.com/dashboard` e faça login.
2. Clique em `Create app`.
3. Em `Redirect URIs`, adicione:
   - `http://localhost:4001/api/v1/integrations/spotify/callback`
4. Copie `Client ID` e `Client Secret` para o arquivo `backend/.env`.
5. Reinicie o back-end e clique em `Conectar Spotify` na central de integrações.

## YouTube Music via cookie

1. Abra `https://music.youtube.com` no navegador e entre na conta de destino.
2. Copie o cabeçalho `Cookie` completo de uma requisição autenticada para `music.youtube.com`.
3. Cole o valor em `YTMUSIC_COOKIE` no `backend/.env`.
4. Reinicie o back-end.

Observação:
- Nunca publique cookies reais em issues, logs, commits ou capturas de tela.
- O cookie pode expirar ou quebrar se o YouTube Music alterar endpoints internos.

## Testes Automatizados (Jest + Supertest)

1. Instale dependências:
   ```bash
   npm install
   ```
2. Rode os testes:
   ```bash
   npm test
   ```

Observações:
- Os testes usam `NODE_ENV=test`.
- Endpoint de vitalidade: `GET /api/health`
- Endpoint de prontidão: `GET /api/ready`
