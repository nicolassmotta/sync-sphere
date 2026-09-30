# SyncSphere Front-end

Interface React/Vite do SyncSphere. O front-end funciona como painel de migração e guia local: mostra checklist de configuração, status técnico das integrações, seleção de playlists, progresso via Socket.io e histórico.

## Tecnologias

- React 18
- Vite 6
- React Router
- Zustand
- Axios com `withCredentials`
- TailwindCSS
- Framer Motion
- Lucide React

## Como Rodar

No uso local principal, o front-end é buildado e servido pelo back-end:

```bash
npm run setup
npm start
```

Abra `http://localhost:8000`.

Para desenvolver a UI com Vite, suba o back-end em `http://localhost:8000` e valide:

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/ready
```

Depois rode:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Configure `VITE_API_URL` quando o back-end não estiver na porta padrão:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

Portas esperadas:

- Aplicação local empacotada: `http://localhost:8000`
- Front-end Vite em desenvolvimento: `http://localhost:5173`
- API do back-end: `http://localhost:8000/api/v1`
- Saúde do back-end: `http://localhost:8000/api/health`
- Prontidão do back-end: `http://localhost:8000/api/ready`

## Fluxo no Front-end

1. Página inicial explica a migração local entre os sete provedores.
2. O painel abre direto, sem login (não há contas).
3. Início mostra checklist, seleção de origem e destino, playlists, fila e progresso.
4. Integrações mostra o estado e a configuração de cada provedor, incluindo leitura pública sem conexão quando disponível.
5. Guia local traz comandos copiáveis, variáveis de ambiente e solução de problemas.
6. Seleção de playlists lista a conta, recebe link/ID ou permite importar um arquivo, conforme a plataforma.
7. Migração usa `/transfer/start`, a fila local e Socket.io.
8. Histórico lista status, pendências, faixas não encontradas e saída criada no destino, com downloads para Arquivo.
9. Revisão manual permite ajustar título/artista, conferir uma alternativa e confirmar sua inserção pela fila.

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
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8000/api/v1/integrations/spotify/callback
```

O fluxo usa Authorization Code + PKCE, então não há `SPOTIFY_CLIENT_SECRET`.

YouTube Music em `backend/.env`:

```env
YTMUSIC_COOKIE=cole_o_cabecalho_cookie_completo_de_music_youtube_com_aqui
YTMUSIC_AUTH_USER=0
```

Use apenas valores demonstrativos em documentação, commits, issues e capturas de tela.

## Convenções

- Centralize HTTP em `src/services/api.js`.
- Preserve `withCredentials` para cookies HttpOnly.
- `src/store/useAuthStore.js` mantém apenas o usuário local fixo (não há login).
- Reaproveite componentes em `src/components/ui`, `src/components/layout`, `src/components/setup` e `src/components/dashboard`.
- Mantenha UI dark, responsiva, utilitária e legível.
- Não adicione camada comercial ou linguagem de produto pago.
- Não exponha tokens, cookies ou segredos reais.

## Solução de Problemas

- Painel não carrega dados: confirme back-end online, `FRONTEND_URL` e `VITE_API_URL`.
- Checklist mostra back-end offline: valide `VITE_API_URL` e `http://localhost:8000/api/health`.
- Spotify desconectado: revise `SPOTIFY_CLIENT_ID` e a URI de redirecionamento no back-end e no painel do Spotify.
- `YTMUSIC_COOKIE` pendente: reinicie o back-end depois de editar `.env` e clique em revalidar.

## Verificação

```bash
npm run lint
npm run build
```
