# Histórico de mudanças

Todas as mudanças relevantes do SyncSphere serão registradas neste arquivo.

## [Não publicado]

### Progresso e fila de pendências

- Painel de migração com tempo estimado, faixas por minuto, contadores (encontradas, não encontradas, na fila de retry) e últimas faixas analisadas.
- Estimativa de duração antes de iniciar, baseada na velocidade medida nas migrações anteriores e na fila atual.
- Estado por faixa persistido: pausas e novas tentativas continuam de onde pararam, sem refazer buscas.
- Bloqueio de busca (429, captcha, cota) pausa a transferência com retomada automática; token ou cookie inválido deixa a transferência aguardando reconexão.
- Faixas com falha temporária ganham rodadas automáticas e, depois do limite, ficam em "Pendências" no Histórico com botão para tentar de novo.
- Fila persistida em `data/queue.json`: transferências não concluídas voltam sozinhas depois de reiniciar o servidor.
- Novas rotas: `GET /transfer/estimate`, `GET /transfer/:id/tracks`, `POST /transfer/:id/retry`, `POST /transfer/:id/resume` e `POST /transfer/retry-all`.

## [1.0.0] - 2026-06-22

### Destaques

- Migração bidirecional de playlists: Spotify para YouTube Music e YouTube Music para Spotify.
- Seleção de uma ou várias playlists do Spotify e leitura de playlist do YouTube Music por link ou ID.
- Criação de playlists privadas nos dois destinos, com busca, correspondência e retomada sem duplicar a playlist criada.
- Spotify OAuth Authorization Code com PKCE, sem `SPOTIFY_CLIENT_SECRET`, com escopos de leitura e escrita.
- Autenticação local do YouTube Music por `YTMUSIC_COOKIE`.
- Painel React com progresso em tempo real por Socket.io e histórico local cifrado.
- Execução self-hosted single-user, sem contas, banco de dados ou Redis.

### Qualidade e segurança

- Cobertura automatizada dos dois sentidos da migração, incluindo criação, retomada e falhas de correspondência.
- Dependências de produção atualizadas para eliminar vulnerabilidades conhecidas pelo `npm audit`.
- CI com testes do back-end, lint e build do front-end e smoke test da aplicação empacotada.

[1.0.0]: https://github.com/nicolassmotta/sync-sphere/releases/tag/v1.0.0
