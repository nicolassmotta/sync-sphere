# Configuração

[Índice da documentação](README.md)

O backend lê `backend/.env` no início do processo. O frontend empacotado usa a API na mesma origem; `frontend/.env` é útil no desenvolvimento com Vite. Os nomes de variáveis são contratos técnicos e ficam em inglês.

## Configuração mínima

Copie [backend/.env.example](../backend/.env.example) e mantenha credenciais vazias para começar com Arquivo. Uma instalação local padrão usa:

```dotenv
NODE_ENV=development
APP_ENV=dev
PORT=8000
FRONTEND_URL=http://localhost:8000
WORKER_ENABLED=true
```

| Variável | Uso |
|---|---|
| `PORT` | Porta do backend e do frontend empacotado. Exemplo: `8000`. |
| `FRONTEND_URL` | Origem autorizada do painel e referência para retornos OAuth. |
| `FRONTEND_URLS` | Origens adicionais separadas por vírgula. |
| `NODE_ENV` | Ambiente Node.js, como `development`, `production` ou `test`. |
| `APP_ENV` | Ambiente da aplicação: `dev`, `prod` ou `test`. |
| `DATA_DIR` | Diretório de dados. Padrão: `backend/data`. Caminhos relativos são resolvidos a partir do diretório de trabalho do processo. |
| `ENCRYPTION_KEY` | Chave de 32 bytes, representada por 64 caracteres hexadecimais. Se vazia, gera `data/encryption.key`. |
| `WORKER_ENABLED` | `false` desativa o processamento neste processo. Mantenha `true` para uso normal. |

Para uma chave própria, gere um valor localmente:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use a mesma chave para reabrir dados existentes. Não substitua `ENCRYPTION_KEY` durante uma atualização com o mesmo diretório de dados.

## Credenciais por plataforma

| Plataforma | Variáveis |
|---|---|
| Spotify | `SPOTIFY_CLIENT_ID`, `SPOTIFY_REDIRECT_URI` opcional |
| YouTube Music | `YTMUSIC_COOKIE`, `YTMUSIC_AUTH_USER` opcional |
| Deezer | `DEEZER_ARL` |
| TIDAL | `TIDAL_CLIENT_ID`, `TIDAL_CLIENT_SECRET` opcional, `TIDAL_REDIRECT_URI`, `TIDAL_COUNTRY_CODE` |
| Apple Music | `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_PATH` ou `APPLE_PRIVATE_KEY` |
| Apple Music, tokens alternativos | `APPLE_MUSIC_USER_TOKEN`, `APPLE_MUSIC_DEVELOPER_TOKEN` |
| SoundCloud | `SOUNDCLOUD_OAUTH_TOKEN`, `SOUNDCLOUD_CLIENT_ID` opcional |

Cookies e tokens de conta podem ser salvos pelo painel quando esse método estiver disponível. Os valores do painel têm prioridade sobre os equivalentes do `.env`. Desconectar remove a credencial persistida pelo painel; uma credencial mantida no `.env` pode voltar a ser usada.

A configuração de OAuth precisa coincidir com o cadastro na plataforma. Com porta `8000`, os retornos padrão são:

```text
http://127.0.0.1:8000/api/v1/integrations/spotify/callback
http://127.0.0.1:8000/api/v1/integrations/tidal/callback
```

Para `APPLE_PRIVATE_KEY`, o aplicativo aceita quebras de linha representadas por `\n`. Usar `APPLE_PRIVATE_KEY_PATH` evita colocar a chave inteira no `.env`. Guarde esse arquivo fora do Git.

O [guia de integrações](integrations.md) explica como obter cada credencial.

## Busca e fila

| Variável | Referência |
|---|---|
| `YOUTUBE_SEARCH_CONCURRENCY` | Nome legado usado como concorrência global de busca. Padrão: `1`; limite: `5`. |
| `MAX_TRACK_ATTEMPTS` | Tentativas por faixa com falha temporária. Padrão: `5`; limite: `20`. |
| `SPOTIFY_SEARCH_DELAY_MS` | Atraso entre buscas no Spotify. Padrão sem variável: `100`. |
| `YT_MUSIC_SEARCH_DELAY_MS` | Atraso no YouTube Music. O `.env.example` usa `750`; sem variável, o provedor usa `250`. |
| `DEEZER_SEARCH_DELAY_MS` | Atraso no Deezer. Padrão: `220`. |
| `TIDAL_SEARCH_DELAY_MS` | Atraso no TIDAL. Padrão: `250`. |
| `APPLE_MUSIC_SEARCH_DELAY_MS` | Atraso no Apple Music. Padrão: `200`. |
| `SOUNDCLOUD_SEARCH_DELAY_MS` | Atraso no SoundCloud. Padrão: `300`. |
| `YTMUSIC_ADD_CHUNK_SIZE` | Faixas por lote de inserção no YouTube Music. Padrão: `100`; limitado a `200`. |

Mantenha números positivos nos atrasos e comece com concorrência `1`. Aumentar concorrência pode aumentar bloqueios de busca. A fila tem uma raia por destino, permitindo que destinos distintos avancem independentemente.

O cache de correspondências tem prazo fixo de sete dias e limite de 5.000 entradas na implementação atual. Não há variável de ambiente para alterar esses valores.

## Região e idioma

| Variável | Padrão |
|---|---|
| `YOUTUBE_MUSIC_GL` | `BR` |
| `YOUTUBE_MUSIC_HL` | `pt-BR` |
| `YTMUSIC_AUTH_USER` | `0`; identifica a conta da sessão quando há múltiplas contas |
| `TIDAL_COUNTRY_CODE` | `BR` |
| `APPLE_MUSIC_STOREFRONT` | `br` |
| `APPLE_MUSIC_AUTO_WEB_TOKEN` | Habilitado; `false` desativa a obtenção automática do token do web player |

O catálogo disponível pode variar por região e conta. A loja presente em um link Apple Music é considerada na leitura do catálogo.

## Desenvolvimento com Vite

Backend:

```dotenv
FRONTEND_URL=http://localhost:5173
FRONTEND_URLS=http://localhost:8000,http://localhost:5174
```

Frontend em `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:8000/api/v1
```

Configure a origem exata exibida pelo Vite. Reinicie o backend após alterar CORS e reinicie o Vite após alterar suas variáveis. No uso empacotado em uma única porta, mantenha `VITE_API_URL` vazio para usar a API da mesma origem.

## Estado OAuth

`JWT_SECRET` é opcional e pode fornecer a assinatura do estado OAuth. Se não estiver definida, o projeto gera `data/oauth-state.secret`. Isso não cria contas ou login no SyncSphere.

Confira [Segurança](../SECURITY.md) antes de expor o servidor fora de uma máquina ou rede confiável.
