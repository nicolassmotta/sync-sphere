# Histórico de mudanças

Todas as mudanças relevantes do SyncSphere serão registradas neste arquivo.

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
