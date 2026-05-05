# SyncSphere Front-end

Interface React/Vite do SyncSphere. O front-end funciona como painel de migração e guia local: mostra checklist de configuração, status técnico das integrações, seleção de playlists, progresso via Socket.io e histórico.

## Tecnologias

- React 18
- Vite
- React Router
- Zustand
- Axios com `withCredentials`
- TailwindCSS
- Framer Motion
- Lucide React

## Como Rodar

Antes de abrir o front-end, suba o back-end em `http://localhost:4001` e valide:

```bash
curl http://localhost:4001/api/health
curl http://localhost:4001/api/ready
```

Depois rode:

```bash
cd frontend
npm install
npm run dev
```

Configure `VITE_API_URL` quando o back-end não estiver na porta padrão:

```env
VITE_API_URL=http://localhost:4001/api/v1
```

Portas esperadas:

- Front-end: `http://localhost:5173`
- API do back-end: `http://localhost:4001/api/v1`
- Saúde do back-end: `http://localhost:4001/api/health`
- Prontidão do back-end: `http://localhost:4001/api/ready`

## Fluxo no Front-end

1. Página inicial explica o fluxo local Spotify -> YouTube Music.
2. Login cria/acessa um usuário local preservando sessão em cookie HttpOnly.
3. Início mostra checklist de back-end, MongoDB, Redis, Spotify OAuth, `YTMUSIC_COOKIE`, seleção, fila e histórico.
4. Integrações mostra back-end online/offline, Mongo/Redis, Spotify conectado/desconectado e cookie configurado/não configurado.
5. Guia local traz comandos copiáveis, variáveis de ambiente e solução de problemas.
6. Seleção de playlists carrega Spotify via OAuth e permite escolher uma ou várias playlists.
7. Migração usa `/transfer/start`, BullMQ e Socket.io.
8. Histórico lista status, falhas de correspondência e playlist criada no YouTube Music.

## Configuração Local Referenciada pela UI

Back-end:

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Spotify OAuth em `backend/.env`:

```env
SPOTIFY_CLIENT_ID=seu_client_id_spotify
SPOTIFY_CLIENT_SECRET=seu_client_secret_spotify
SPOTIFY_REDIRECT_URI=http://localhost:4001/api/v1/integrations/spotify/callback
```

YouTube Music em `backend/.env`:

```env
YTMUSIC_COOKIE=cole_o_cabecalho_cookie_completo_de_music_youtube_com_aqui
YTMUSIC_AUTH_USER=0
```

Use apenas valores demonstrativos em documentação, commits, issues e capturas de tela.

## Convenções

- Centralize HTTP em `src/services/api.js`.
- Preserve `withCredentials` para cookies HttpOnly.
- Use `src/store/useAuthStore.js` para estado de sessão enquanto o fluxo autenticado existir.
- Reaproveite componentes em `src/components/ui`, `src/components/layout`, `src/components/setup` e `src/components/dashboard`.
- Mantenha UI dark, responsiva, utilitária e legível.
- Não adicione camada comercial ou linguagem de produto pago.
- Não exponha tokens, cookies ou segredos reais.

## Solução de Problemas

- Tela de login não autentica: confirme back-end online, `FRONTEND_URL` e cookie HttpOnly aceito pelo navegador.
- Checklist mostra back-end offline: valide `VITE_API_URL` e `http://localhost:4001/api/health`.
- Mongo/Redis pendente: confira `http://localhost:4001/api/ready`.
- Spotify desconectado: revise credenciais e URI de redirecionamento no back-end e no painel do Spotify.
- `YTMUSIC_COOKIE` pendente: reinicie o back-end depois de editar `.env` e clique em revalidar.

## Verificação

```bash
npm run lint
npm run build
```
