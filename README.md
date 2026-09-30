# SyncSphere

Versão 1.1.0 em preparação. Consulte as [notas da versão](docs/releases/v1.1.0.md) e o [plano das fases](docs/roadmap.md).

SyncSphere é um migrador local e de código aberto de playlists entre Spotify, YouTube Music, Deezer, TIDAL, Apple Music, SoundCloud e arquivos CSV, JSON, M3U ou TXT. O painel guia a configuração, permite escolher origem e destino e acompanha progresso, retomadas e revisão de músicas não encontradas.

É **self-hosted single-user**: você clona e usa na sua própria máquina, configurando apenas as plataformas escolhidas. A conversão entre arquivos e a leitura pública de algumas plataformas funcionam sem conectar uma conta. Os dados ficam em arquivos locais cifrados e a fila persiste no próprio processo, sem banco de dados nem Redis.

## Fluxo Local

1. Instale dependências e gere o build do front-end com `npm run setup`.
2. Configure o back-end (`backend/.env`).
3. Suba o servidor único com `npm start`.
4. Abra `http://localhost:8000`.
5. Em Integrações, conecte as plataformas necessárias ao seu fluxo.
6. Escolha origem e destino.
7. Selecione uma playlist da conta, cole seu link/ID ou importe um arquivo.
8. Inicie a migração e acompanhe progresso e histórico. Revise manualmente as faixas não encontradas quando necessário.

## Arquitetura

Para contribuir, consulte [CONTRIBUTING.md](CONTRIBUTING.md). Relatos de segurança seguem [SECURITY.md](SECURITY.md).

- `backend/`: Node.js + Express em ESM, Socket.io, Zod. Persistência local em arquivos JSON cifrados (`backend/data/`) e fila de transferências local persistida em `data/queue.json`.
- `frontend/`: React 18 + Vite, React Router, Zustand, Axios com `withCredentials`, TailwindCSS, Framer Motion e Lucide.
- `docs/ai/`: contexto operacional para agentes e decisões recorrentes do projeto.
- `.agents/skills/sync-sphere/`: skill local usada por agentes que trabalham neste repositório.

Sem MongoDB, sem Redis, sem contas: a aplicação sobe sem nenhuma dependência de infraestrutura externa.

## Plataformas

Cada plataforma é um adaptador em `backend/src/providers/<id>/`, registrado em `backend/src/providers/registry.js`. O painel permite escolher pares diferentes de origem e destino, além de Arquivo -> Arquivo para converter formatos. A disponibilidade de leitura e escrita depende das credenciais e do catálogo de cada serviço.

| Plataforma | Origem | Destino | Autenticação | Observações |
|---|---|---|---|---|
| Spotify | sim | sim | OAuth + PKCE (`SPOTIFY_CLIENT_ID`) | Lista as playlists da conta conectada. |
| YouTube Music | sim | sim | Cookie colado no painel ou `YTMUSIC_COOKIE` | API não oficial; origem por link ou ID de music.youtube.com ou youtube.com. A playlist criada também aparece no YouTube. |
| Deezer | sim | sim | Nenhuma para ler playlists públicas; cookie `arl` (painel ou `DEEZER_ARL`) para listar suas playlists, ler privadas e criar | Busca exata por ISRC antes da busca por texto. Escrita usa o gateway interno do site (não oficial). |
| TIDAL | sim | sim | OAuth + PKCE (`TIDAL_CLIENT_ID`; `TIDAL_CLIENT_SECRET` opcional para ler sem login) | API oficial v2. Busca por ISRC. Playlists criadas como "não listadas" (a API não cria privadas). |
| Apple Music | sim | sim | Nenhuma para ler playlists do catálogo; conta via MusicKit (chave `APPLE_*`) ou cookie `media-user-token` para biblioteca e escrita | Busca por ISRC. Sem chave MusicKit usa o token público do web player (não oficial). |
| SoundCloud | sim | sim | Nenhuma para ler playlists públicas; cookie `oauth_token` (painel ou `SOUNDCLOUD_OAUTH_TOKEN`) para escrever | API do site (a oficial exige Artist Pro). Catálogo com muito upload de terceiros: só aceita faixa do mesmo artista. |
| Arquivo | sim | sim | Nenhuma | Importa CSV (Exportify e genérico), JSON, M3U/M3U8 e TXT "Artista - Título"; exporta nos mesmos formatos. Arquivo -> Arquivo converte formatos. |

## Requisitos

- Node.js 20+
- Credenciais apenas das plataformas que você pretende conectar, conforme a tabela acima.
- Para Spotify: app com OAuth configurado. Para YouTube Music: cookie colado em Integrações ou definido em `YTMUSIC_COOKIE`.

Apps Spotify em modo de desenvolvimento exigem Premium na conta proprietária do app e têm restrições para playlists de terceiros. Consulte o [guia oficial do Spotify](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide).

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

Preencha `backend/.env` conforme as plataformas escolhidas e inicie:

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

`/api/ready` retorna `storage: "local"` e `queue: "local-persistent"`.

## 3. Spotify OAuth

No painel de desenvolvedores (`https://developer.spotify.com/dashboard`):

- crie ou abra um app;
- em "Redirect URIs", cadastre exatamente `http://127.0.0.1:8000/api/v1/integrations/spotify/callback` (o Spotify exige o IP de loopback `127.0.0.1`, não `localhost`);
- copie o `Client ID` para `SPOTIFY_CLIENT_ID` em `backend/.env` (não precisa de Client Secret);
- reinicie o back-end e conecte pelo painel em `Integrações`;
- reconecte o Spotify se a autorização antiga não incluir `playlist-modify-private`/`playlist-modify-public`, necessárias para YouTube Music -> Spotify.

> Observação: um app Spotify novo nasce em "Development Mode" e só permite até 25 contas adicionadas manualmente no painel. Para liberar para qualquer pessoa, peça o "Extended Quota Mode" na revisão do Spotify.

## 4. Cookie do YouTube Music

YouTube Music usa o cookie da sua sessão no navegador como origem ou destino.

1. Abra `https://music.youtube.com` logado na conta que vai usar.
2. Abra as ferramentas de desenvolvedor, aba Rede.
3. Clique em uma requisição para `music.youtube.com`.
4. Copie o cabeçalho `Cookie` completo.
5. Cole na aba `Integrações` do painel e clique em `Salvar cookie`. O cookie fica cifrado em `backend/data/` e vale na hora, sem reiniciar.

Alternativa: cole em `YTMUSIC_COOKIE` no `backend/.env` e reinicie o back-end. O cookie salvo pelo painel tem prioridade sobre o do `.env`.

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
- Transferências longas rodam fora do ciclo HTTP, em uma fila no próprio processo que sobrevive a reinícios.
- Cada faixa tem estado próprio. Se o YouTube Music limitar as buscas ou um token expirar, a transferência pausa (ou espera a reconexão) e continua de onde parou, sem refazer buscas.
- Novas transferências reutilizam correspondências confiáveis encontradas anteriormente no mesmo destino. O cache é cifrado em `backend/data/match-cache.json`, expira em sete dias e guarda até 5.000 entradas. Versões e durações diferentes são tratadas separadamente. Faixas não encontradas voltam a ser buscadas.
- Para revisar uma faixa não encontrada, abra `Histórico > Ver detalhes > Não encontradas > Escolher alternativa`. Ajuste título e artista, busque e confira o resultado antes de confirmar. A música será acrescentada ao fim da playlist existente. A revisão fica disponível depois que a transferência terminar; propostas expiram em dez minutos.
- Antes de inserir faixas, os destinos comparam as quantidades esperadas com o conteúdo atual da playlist. Isso preserva repetições intencionais e evita reenviar ocorrências já presentes numa retomada. Se não for possível ler o destino, a inserção é interrompida. Faixas recuperadas depois entram no fim das playlists remotas; arquivos exportados seguem a ordem da origem.
- O painel mostra tempo estimado, faixas por minuto, contadores e as últimas faixas analisadas. Faixas que falharam ficam em "Pendências" no Histórico, com botão para tentar de novo.
- Socket.io publica progresso para o painel.
- Como tudo roda local, mantenha `backend/data/` e o `.env` fora de qualquer repositório público.

## Solução de Problemas

- Front-end não conecta: confira `VITE_API_URL`, `FRONTEND_URL`, porta `8000` e CORS.
- Spotify OAuth falha: confirme se `SPOTIFY_CLIENT_ID` está no `.env` e se `SPOTIFY_REDIRECT_URI` é idêntico no `.env` e no painel do Spotify.
- YouTube Music fica pendente: cole o cookie em `Integrações` (ou preencha `YTMUSIC_COOKIE` e reinicie o back-end).
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
