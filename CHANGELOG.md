# Histórico de mudanças

Todas as mudanças relevantes do SyncSphere serão registradas neste arquivo.

## [Não publicado]

### Integridade e recuperação

- Dados essenciais ilegíveis agora interrompem leitura e inicialização, preservando arquivos e chave local. Prontidão retorna 503 ao detectar falha de armazenamento.
- Retry recupera inserções pendentes sem repetir buscas, perder revisão manual ou criar outra playlist persistida. Histórico e ação geral incluem essas pendências.
- Falhas temporárias de job publicam pausa com o horário persistido pela fila; falha terminal só ocorre quando definitiva ou após esgotar tentativas.
- Snapshots cortados por limite são recusados antes de criar o destino, com total e omissões preservados e orientação para dividir a playlist.
- Cache de correspondências usa índice compartilhado em memória e checkpoints cifrados, preservando validade, limite e isolamento entre destinos.

### Documentação e apresentação

- README reorganizado com apresentação visual, instalação rápida, demonstração sem contas e navegação dos guias públicos.
- Guias de integrações, configuração, uso, formatos, diagnóstico, arquitetura e API alinhados ao código atual.
- Materiais de divulgação, capturas demonstrativas e playlist de exemplo adicionados.
- Requisitos do Spotify atualizados com referência oficial e recomendação de Node.js LTS suportado.
- Credenciais opcionais vazias no `.env.example` para começar pelo fluxo Arquivo sem falsas conexões.
- Guia embutido e contexto de manutenção atualizados para os sete provedores e a fila persistida.

## [1.1.0] - Em preparação

### Preparação da versão

- Versões da raiz, backend, frontend e lockfiles alinhadas em 1.1.0.
- Dependências atualizadas com correções de segurança; Vite atualizado para 6.4.3 e plugin React para 4.7.0.
- README e título do aplicativo alinhados às sete plataformas.
- Guias de contribuição, segurança, fases e notas de versão adicionados.

### Fidelidade e retomada segura

- Destinos reconciliam quantidades de cada faixa antes de inserir, preservando repetições intencionais e evitando duplicatas ao repetir uma escrita parcialmente concluída.
- Exportações em Arquivo são reconstruídas na ordem das faixas resolvidas da origem durante retomadas.
- YouTube Music e Apple Music interrompem a inserção se não conseguirem ler o destino, em vez de tratar a playlist como vazia.
- Spotify usa `/me/playlists` e `/playlists/:id/items` na criação, leitura e inserção de itens. TIDAL usa `onDuplicates: ADD` após reconciliar o estado do destino.
- Armazenamento cifrado grava e sincroniza um arquivo temporário antes de substituir o anterior por renomeação atômica.
- Arquivos com mais de 5.000 faixas e inserções acima do limite do SoundCloud são recusados explicitamente, sem cortar a lista silenciosamente.
- Suítes de teste passam a usar diretórios temporários separados para evitar contaminação entre execuções.

### Revisão manual de faixas

- O Histórico permite ajustar título e artista, buscar uma alternativa no destino e confirmar a música desejada para faixas não encontradas ou com falha definitiva.
- A escolha confirmada entra na fila e é acrescentada à playlist existente; as faixas já inseridas são preservadas.
- Propostas são geradas no servidor, expiram em dez minutos e não podem ser confirmadas durante outra execução da transferência.
- Cabeçalho do modal ajustado para evitar um segundo marco de navegação na acessibilidade.

### Cache de correspondências

- Transferências novas reutilizam correspondências confiáveis já encontradas na plataforma de destino, sem repetir a busca nem seu atraso.
- Cache local cifrado com validade de sete dias e limite de 5.000 entradas. Identidade considera plataforma, contexto do catálogo, título completo, artista, álbum, ISRC e duração.
- Resultados ausentes, pouco confiáveis e erros continuam sendo buscados em novas tentativas.
- Métricas de velocidade de busca externa ignoram acertos de cache.

### Plataforma SoundCloud

- Nova plataforma `soundcloud`: lê playlists públicas e busca sem login (client_id público do site, renovado sozinho), completa faixas resumidas em lote e cria playlists privadas com o cookie `oauth_token`.
- Busca ignora prévias de 30 s e exige artista em comum, para não trocar a música por um cover.
- Pontuação compartilhada penaliza versões que a faixa original não tem (remix, cover, ao vivo, sped up, edit...).
- Teste de contrato garante normalização de ID idempotente em todas as plataformas (corrige links do SoundCloud normalizados duas vezes).

### Plataforma Apple Music

- Nova plataforma `appleMusic`: lê playlists do catálogo (pela loja do link) e da biblioteca, busca por ISRC antes do texto, cria playlists na biblioteca e adiciona só faixas novas.
- Oficial: developer token ES256 assinado com a chave MusicKit (`APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY[_PATH]`) e botão "Conectar com Apple Music" via MusicKit JS.
- Sem conta de desenvolvedor: usa o token público do web player (lido do music.apple.com, com cache) e o cookie `media-user-token` colado no painel.
- CSP do Helmet libera capas https (Spotify e demais) e o MusicKit JS.
- Correção: textos longos no progresso não empurram mais o layout para fora da tela.

### Plataforma TIDAL

- Nova plataforma `tidal` pela API oficial v2 (JSON:API) com OAuth Authorization Code + PKCE e refresh automático do token.
- Lê playlists (paginação por cursor, artistas e álbum em lote), busca por ISRC antes do texto, cria playlists "não listadas" e adiciona faixas em lotes de 50 após reconciliar as ocorrências existentes.
- `TIDAL_CLIENT_SECRET` opcional habilita Client Credentials para ler playlists públicas e buscar sem conectar a conta.
- PKCE compartilhado em `modules/integrations/shared/pkceStore.js`.

### Plataforma Deezer

- Nova plataforma `deezer`: lê playlists públicas e busca pela API aberta, sem login, com busca exata por ISRC antes da busca por texto.
- Com o cookie `arl` (colado no painel ou `DEEZER_ARL`): lista as playlists da conta, lê privadas e cria playlists privadas pelo gateway do site.
- Status das plataformas ganha `canRead`/`canWrite`: o painel permite Deezer como origem sem login.
- Pontuação de candidatos compartilhada em `services/matching/scoreCandidate.js`, com ISRC e palavras em comum no artista.

### Plataforma Arquivo

- Nova plataforma `file`: importa CSV (Exportify e genérico, com `,`/`;`/tab e cabeçalhos em português ou inglês), JSON, M3U/M3U8 e TXT como origem; como destino gera arquivo para baixar em CSV, JSON, M3U ou TXT pelo Histórico.
- Arquivo -> Arquivo converte formatos (ex.: CSV do Exportify em M3U).
- Rotas `POST /integrations/file/imports`, `DELETE /integrations/file/imports/:id` e `GET /integrations/file/exports/:id/download?format=`.

### Arquitetura de provedores

- Cada plataforma virou um adaptador em `backend/src/providers/` com contrato único (autenticação, capacidades, leitura, busca e destino); o processador, a validação de início e as rotas de integração funcionam para qualquer par origem/destino.
- Rotas genéricas `/integrations/:provider/...`; as URLs antigas do Spotify e do YouTube Music continuam válidas.
- `POST /transfer/start` aceita `sourceProvider` e `targetProvider`, mantendo `direction` para compatibilidade.
- Cookie do YouTube Music pode ser colado no painel (cifrado em `data/provider-credentials.json`), sem editar `.env` nem reiniciar.
- Fila com uma raia por plataforma de destino: bloqueio em uma plataforma não trava migrações para outra.
- Faixas do Spotify passam a guardar ISRC.
- Painel escolhe origem e destino entre as plataformas registradas; aba Integrações gerada a partir do back-end.

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
