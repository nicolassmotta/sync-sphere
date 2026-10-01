# API local

[Índice da documentação](README.md)

Base padrão: `http://localhost:8000/api/v1`. Esta API atende a instalação local e não possui login ou tokens próprios do SyncSphere. O middleware associa os pedidos ao usuário implícito `local`.

Não exponha a API publicamente sem uma camada externa de proteção. Credenciais dos serviços de música são configuradas pelas integrações e não substituem autenticação de acesso ao aplicativo.

## Saúde

| Método e rota | Resultado |
|---|---|
| `GET /api/health` | Processo ativo, ambiente e tempo de execução. |
| `GET /api/ready` | Prontidão do armazenamento local e da fila persistida. |

Essas rotas ficam fora de `/api/v1`.

## Integrações

Todas as rotas abaixo usam `/api/v1` como prefixo. IDs dos provedores: `spotify`, `youtubeMusic`, `deezer`, `tidal`, `appleMusic`, `soundcloud`, `file`.

| Método e rota | Uso |
|---|---|
| `GET /integrations/status` | Provedores, capacidades e estado de leitura/escrita. |
| `GET /integrations/:provider/login` | URL de autorização OAuth. |
| `GET /integrations/:provider/callback` | Retorno OAuth e redirecionamento ao painel. |
| `PUT /integrations/:provider/credentials` | Salvar campos de credencial em `values`. |
| `DELETE /integrations/:provider` | Remover a credencial persistida pelo painel. |
| `GET /integrations/:provider/playlists` | Playlists da conta, quando suportado. |
| `GET /integrations/:provider/playlists/:playlistId/tracks` | Preview com `limit` opcional. |
| `GET /integrations/:provider/playlist-tracks?playlistId=...` | Preview para links/IDs que não cabem facilmente no caminho. |
| `GET /integrations/:provider/developer-token` | Developer token do MusicKit quando configurado. |

O corpo de credenciais tem esta forma. Substitua valores somente na sua instalação:

```json
{
  "values": {
    "cookie": "valor-local-da-sessao"
  }
}
```

Os nomes dos campos variam por provedor e são anunciados em `auth.fields` pelo status. Métodos não suportados pelo provedor geram erro operacional.

## Arquivo

| Método e rota | Uso |
|---|---|
| `POST /integrations/file/imports?filename=playlist.csv` | Conteúdo textual em `text/plain`, até 5 MB. |
| `DELETE /integrations/file/imports/:importId` | Remover uma importação. |
| `GET /integrations/file/exports/:exportId/download?format=csv` | Baixar CSV, JSON, M3U ou TXT. |

Exemplo na raiz do repositório:

```bash
curl --fail --request POST \
  'http://localhost:8000/api/v1/integrations/file/imports?filename=playlist.csv' \
  --header 'Content-Type: text/plain' \
  --data-binary @docs/examples/playlist.csv
```

No PowerShell, use `curl.exe` e a continuação de linha com acento grave:

```powershell
curl.exe --fail --request POST `
  'http://localhost:8000/api/v1/integrations/file/imports?filename=playlist.csv' `
  --header 'Content-Type: text/plain' `
  --data-binary '@docs/examples/playlist.csv'
```

Use o `data.playlist.id` retornado como origem de uma transferência.

## Transferências

| Método e rota | Uso |
|---|---|
| `POST /transfer/start` | Validar origens e enfileirar uma transferência por playlist. |
| `GET /transfer` | Até 50 transferências mais recentes. |
| `GET /transfer/:transferId` | Estado persistido de uma transferência. |
| `GET /transfer/estimate?targetProvider=file&count=3` | Estimativa e fila à frente. |
| `GET /transfer/:transferId/tracks` | Estado por faixa e contadores. |
| `POST /transfer/:transferId/retry` | Tentar novamente pendências elegíveis. |
| `POST /transfer/retry-all` | Reenfileirar pendências elegíveis do histórico. |
| `POST /transfer/:transferId/resume` | Solicitar retomada agora. |

Corpo recomendado de início:

```json
{
  "sourceProvider": "file",
  "targetProvider": "file",
  "sourcePlaylistIds": ["import-id-retornado-pela-api"]
}
```

Também aceita `sourcePlaylistId` singular. `direction` continua disponível para compatibilidade; prefira os dois campos explícitos de provedor. A resposta `202` contém `transferId` e `transferIds`.

A consulta de faixas aceita `status` com valores separados por vírgula, por exemplo `not_found,failed`. Valores possíveis: `pending`, `matched`, `not_found`, `retry_queued`, `failed`.

## Revisão manual

```text
POST /transfer/:transferId/tracks/:trackIndex/search
POST /transfer/:transferId/tracks/:trackIndex/confirm
```

Buscar:

```json
{
  "name": "Título ajustado",
  "artist": "Artista desejado"
}
```

A resposta contém `data.candidate` com a proposta ou `null`. O índice é o `index` retornado no estado por faixa, começando em zero.

Confirmar:

```json
{
  "candidateId": "b7657d61-25d1-46f5-b165-3a1d138cd8a5"
}
```

Envie o UUID real da proposta. A confirmação não aceita um identificador arbitrário de faixa. Propostas duram dez minutos; a transferência precisa estar terminada e sem job ativo. A resposta `202` reenfileira a inserção.

## Socket.io

Conecte à mesma origem do backend e envie `subscribe_transfer` com o ID da transferência. O servidor usa a sala `transfer:<id>` e publica:

| Evento | Conteúdo |
|---|---|
| `transfer_subscribed` | Confirmação de inscrição com `transferId`. |
| `transfer_update` | Status, fase, progresso, contadores, ETA e dados da saída. |
| `transfer_error` | Mensagem sobre inscrição inválida ou indisponível. |

O snapshot de progresso usa `counts`, `etaSeconds`, `tracksPerMinute`, `resumeAt`, `pauseReason`, `targetPlaylistUrl` e `queuePosition`. Faixa atual e últimas faixas são informações de execução e podem estar vazias após reconectar.

## Respostas e limites

Respostas de sucesso usam `status: "success"` e `data`. Erros operacionais expõem `message`. Os status usuais incluem `400` para entrada inválida, `404` para recurso ausente, `409` para conflito de estado e `429` para limite de requisições.

Os limites gerais e de ações estão em [rateLimiter.js](../backend/src/middlewares/rateLimiter.js). A API não fornece paginação completa do histórico na implementação atual. Veja os [limites de leitura e importação](usage.md#limites-atuais).


## Suporte local

As rotas abaixo só aceitam conexões de loopback e respondem com `Cache-Control: no-store`:

| Método e rota | Contrato |
|---|---|
| `POST /api/v1/system/demo` | Importa uma playlist com três ocorrências fictícias e devolve `data.playlist`. Não inicia transferência sozinho. |
| `GET /api/v1/system/diagnostic` | Devolve `data` com versão, plataforma, prontidão e contagens, sem dados privados ou logs. |
| `GET /api/v1/system/providers/:providerId/setup` | Para Spotify/TIDAL, informa `configured` e `redirectUri`, sem devolver o Client ID. |
| `PUT /api/v1/system/providers/:providerId/setup` | Recebe `{ clientId }`, valida caracteres/tamanho e persiste cifrado. Recusa alteração com conta conectada ou fila pendente. |
| `POST /api/v1/system/backups` | Recebe `{ password }`, com 12 a 200 caracteres. Devolve arquivo `.ssb` cifrado e recusa fila pendente. |

`GET /api/v1/transfer/:transferId/report?format=json|csv` baixa um relatório da transferência local, com situação por ocorrência, contagens e metadados de leitura da origem. O padrão é JSON.

A restauração não possui rota HTTP. Use o iniciador Restaurar-backup ou `npm run backup:restore -- --interactive`, com o servidor fechado. Saúde inclui `application`, `version` e `pid`; o iniciador usa a identificação da instância para evitar abrir uma instalação diferente que ocupe a mesma porta.
