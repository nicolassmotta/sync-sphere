# Plano de ação: correspondência, revisão e integridade de playlists

[Índice da documentação](README.md) · [Fases do projeto](roadmap.md)

Estado: implementado com validação local em 04/10/2026. Operações em contas reais permanecem fora desta evidência. Veja [resultados e limitações](validation-matching-quality.md).

## Objetivo

Transferir a gravação correta, ampliar a busca quando faltar evidência, permitir escolhas informadas e explicar o resultado de cada faixa. Preservar execução local, armazenamento cifrado, fila persistida e os sete provedores existentes.

Prioridade: reduzir correspondências erradas antes de aumentar a quantidade de resultados aceitos. Nenhuma pontuação será apresentada como probabilidade de acerto sem calibração.

## Diagnóstico anterior à implementação

| Área | Comportamento observado | Consequência |
|---|---|---|
| Aceitação | `TrackMatcher` usa limite padrão de 45; título exato pode render 60 | Pode aceitar uma faixa sem evidência suficiente do artista |
| Pontuação | Spotify, YouTube Music e provedores novos usam implementações diferentes | Critérios inconsistentes entre destinos |
| Versões | Spotify e YouTube Music removem parênteses na comparação sem a penalidade de versão do matcher compartilhado | Risco de confundir original, cover, remix e ao vivo |
| Normalização | Comparadores reduzem texto a letras ASCII e números | Títulos e artistas em outros alfabetos podem perder a identidade |
| Fallback | Deezer amplia a consulta quando não há candidatos; YouTube Music busca vídeos quando não há músicas | Candidatos fracos podem impedir uma busca melhor |
| Contrato | Provedor devolve somente `searchBestMatch` | Não expõe alternativas nem diferença entre os melhores resultados |
| Revisão | Busca ajustada devolve uma proposta; confirmação reenfileira a transferência | Falta comparar alternativas e confirmar várias escolhas juntas |
| Revisão elegível | Restrita a `not_found` e `failed` em transferências terminadas | Não permite corrigir uma escolha automática já inserida |
| Cache | Guarda ID e pontuação, com limite mínimo próprio de 45 | Critérios novos precisam invalidar decisões antigas e guardar evidências |
| Relatório | CSV/JSON com resumo e campos básicos por faixa | Faltam resultado escolhido, estratégia, diferenças e causas detalhadas |
| Ordem | Reconciliação preserva quantidades; recuperações remotas acrescentam ao final | Ordem pode divergir da origem após revisão ou retry |

Fontes: `TrackMatcher.js`, `scoreCandidate.js`, pontuações Spotify/YouTube Music, adaptadores, `manualMatchService.js`, `MatchCache.js`, `transferReportService.js` e `docs/roadmap.md`.

## Decisões adotadas

1. Transferir automaticamente somente resultados com evidência suficiente. Dúvidas ficam para revisão ao final, sem bloquear a busca das outras faixas.
2. Exibir até cinco alternativas distintas por faixa. Persistir um conjunto limitado de candidatos e evidências, sem respostas completas das APIs.
3. Fallback amplia a consulta, mas mantém exigências de identidade e versão. Uma consulta ampla não autoriza uma escolha mais arriscada.
4. Escolhas do usuário são explícitas. Não substituir original por cover, remix, acústica ou ao vivo silenciosamente.
5. Permitir confirmar escolhas em lote antes de reenfileirar. O lote é uma operação local; a escrita externa pode terminar parcialmente e deve ser retomável.
6. Manter limites por destino, respeitar `Retry-After` e preservar checkpoints. Falha técnica nunca vira ausência de catálogo.
7. Manter compatibilidade de leitura com transferências antigas. Registros sem evidências aparecem como legados, sem reconstruir informação inexistente.
8. Primeira entrega revisa faixas ainda não inseridas. Correção de faixas já inseridas e reparo de ordem dependem de capacidades específicas e entram depois.

Estas decisões estão implementadas. A política inicial usa score mínimo de 90, margem de oito pontos entre candidatos elegíveis e orçamento de seis estratégias/12 requisições. Os resultados sintéticos e as limitações estão no [registro de validação](validation-matching-quality.md).

## Fase 0: estabelecer referência de qualidade

### Tarefas

- [x] Montar fixtures sintéticas com origem, candidatos, resultado correto ou ausência de resultado e justificativa.
- [x] Cobrir título igual com artista diferente, participações, aliases conhecidos, pontuação, acentos e alfabetos não latinos.
- [x] Cobrir original/remix/live/cover, remaster, radio edit, explicit/clean e versões com duração diferente. Registrar quando a política admite equivalência e quando exige revisão.
- [x] Cobrir metadados ausentes, título/artista vazios, duração desconhecida, ISRC igual/diferente e empate entre candidatos.
- [x] Cobrir repetições intencionais, catálogo regional e resultados indisponíveis quando houver metadados para detectá-los.
- [x] Executar os critérios atuais sobre as fixtures e registrar a referência de acertos, erros e abstenções.
- [x] Separar exemplos de ajuste e avaliação para evitar calibrar e avaliar com os mesmos casos.

### Entregáveis e arquivos

- Fixtures em `backend/tests/fixtures/matching/`.
- Suíte de avaliação em `backend/tests/matching-quality.test.js`.
- Registro de referência em `docs/validation-matching-quality.md`, incluindo tamanho e limitações da amostra.
- Reaproveitar `matching-confidence.test.js` e `track-matcher.test.js`.

### Critérios de aceite

Nenhum caso crítico de artista errado ou versão incompatível pode ser aceito automaticamente na suíte. Resultados devem permitir distinguir precisão das aceitações e cobertura automática. A meta numérica de cobertura só será fixada após medir a referência; fixtures não comprovam desempenho em catálogos reais.

## Fase 1: unificar identidade e decisão de correspondência

### Tarefas

- [x] Separar título original, título comparável e atributos de versão. Preservar texto original para exibição e auditoria.
- [x] Implementar normalização Unicode que preserve outros alfabetos e nunca trate dois textos vazios como correspondência.
- [x] Representar artistas como lista quando disponível; evitar depender do primeiro token do nome.
- [x] Unificar comparação de título, artistas, duração, ISRC e versão em `services/matching/`.
- [x] Tratar duração ausente como evidência ausente. Divergências grandes e versões incompatíveis devem impedir aceitação automática conforme a política testada.
- [x] Definir `accepted`, `needs_review` e `no_match` como decisões, separadas de erro operacional.
- [x] Calcular a margem entre os dois melhores candidatos após deduplicação por identidade de destino.
- [x] Registrar razões estruturadas da decisão e versão do algoritmo. Não usar somente um número para autorizar inserção.
- [x] Substituir as três regras atuais gradualmente. Centralizar a política também usada pelo cache.

### Arquivos principais

`backend/src/services/matching/scoreCandidate.js`, módulos de normalização/decisão a criar, `services/spotify/spotifyTrackMatchScoring.js`, `services/youtubeMusic/youtubeMusicMatchScoring.js` e `services/transfer/TrackMatcher.js`.

### Critérios de aceite

Mesmo par origem/candidato produz a mesma avaliação, independentemente do adaptador. Artista errado, título vazio e versão incompatível não passam por título ou duração isoladamente. Evidências ausentes ou ambíguas levam a revisão. ISRC é evidência forte, mas não substitui verificações de disponibilidade e consistência dos metadados quando presentes.

## Fase 2: candidatos e fallback progressivo

### Contrato implantado

Adicionar ao cliente de busca `searchCandidates({ track, strategy, limit })`, com candidatos normalizados: `targetId`, título original, artistas, álbum, duração, ISRC, link e disponibilidade quando fornecida pelo destino. A camada comum controla estratégias, pontua, deduplica e decide.

Manter `searchBestMatch` temporariamente como ponte para adaptadores ainda não migrados. Essa ponte devolve apenas um candidato e deve sinalizar evidência limitada, sem fingir que comparou alternativas. Destino Arquivo permanece um fluxo de preservação de metadados, sem busca remota.

### Tarefas

- [x] Atualizar contrato e capacidades em `providers/registry.js`.
- [x] Criar orquestrador de estratégias em `services/matching/`.
- [x] Executar: ISRC suportado, título/artista completos, consulta normalizada, variações de participações, contexto de álbum e busca ampla filtrada.
- [x] Preservar atributos de versão mesmo quando removidos da consulta textual.
- [x] Acionar a próxima estratégia tanto em ausência de candidatos quanto em evidência insuficiente ou ambiguidade.
- [x] Encerrar cedo somente quando a decisão for confiável; acumular candidatos úteis e remover repetições entre consultas.
- [x] Migrar primeiro Spotify e YouTube Music; depois Deezer, TIDAL, Apple Music e SoundCloud.
- [x] Verificar documentação oficial e implementação de cada adaptador antes de depender de filtros, ISRC ou leitura de disponibilidade. Capacidades ausentes ficam explícitas.
- [x] Aplicar orçamento de consultas/tempo por faixa e controle de requisições por destino. O fallback inteiro deve respeitar o limitador, inclusive com concorrência.
- [x] Propagar autenticação, rate limit e indisponibilidade para o fluxo atual de pausa/retry.
- [x] Persistir estratégia, candidatos limitados e checkpoint; retomar sem refazer consultas concluídas quando o contexto continuar válido.

### Critérios de aceite

Um resultado fraco não encerra a procura. Consulta ampla não aceita artista errado. Rate limit pausa a transferência; timeout gera retry, não `no_match`. Retomadas conservam alternativas e decisões. A contagem de chamadas nunca excede o orçamento configurado.

## Fase 3: estado persistido e revisão por API

### Modelo implantado

Adicionar `needs_review` e `skipped` ao estado por faixa, mantendo `pending`, `matched`, `not_found`, `retry_queued` e `failed`. `matched` continua separado de `inserted`; uma escolha ainda não inserida não conta como transferência concluída daquela faixa.

Persistir versão do formato, versão do algoritmo, estratégia, evidências, candidatos, decisão e revisão. Cada candidato tem identificador gerado pelo servidor, vínculo com transferência/faixa, revisão do conjunto e validade. Separar candidatos para exibição de propostas ainda válidas para confirmação.

### Tarefas

- [x] Atualizar `TransferTrackStore`, contadores, filtros, erros legados, recuperação no boot e snapshots de progresso.
- [x] Definir transferência concluída com pendências de revisão sem impedir a revisão; exibir esse resumo de forma distinta do sucesso integral.
- [x] Atualizar `manualMatchService` para devolver lista, buscar com dados editados, ignorar faixa e confirmar lote.
- [x] Preservar rotas antigas de busca/confirmação durante a transição; documentar novos payloads e limites.
- [x] Validar com Zod tamanho do lote, índices duplicados, IDs, revisão do conjunto e elegibilidade das faixas.
- [x] Validar todo o lote antes de persistir. Salvar as escolhas em conjunto e criar um único job para a transferência.
- [x] Rejeitar candidato expirado, de outra faixa, alterado ou enviado como ID externo arbitrário.
- [x] Garantir confirmação repetida sem inserção duplicada e impedir corrida entre revisão, retry e worker.
- [x] Tratar a janela entre salvar faixas, salvar transferência e enfileirar. Recuperação no boot deve reenfileirar escolhas pendentes sem nova confirmação.
- [x] Preservar a capacidade de confirmar uma faixa só, usando o mesmo fluxo do lote.

### Arquivos principais

`manualMatchService.js`, `TransferTrackStore.js`, `TransferProcessor.js`, `transferQueueActions.js`, `transferProgressSnapshot.js`, `transferQueryService.js`, rotas/controllers/schemas de transferência e `queueService.js` quando necessário.

### Critérios de aceite

Revisão sobrevive a reinício. Clique duplo ou requisição repetida não duplica ocorrências. Falha no meio da escrita externa preserva itens pendentes. Transferências antigas seguem legíveis. Nenhuma faixa aguardando revisão entra na playlist automaticamente.

## Fase 4: interface de revisão com múltiplas alternativas

### Tarefas

- [x] Exibir resumo: adicionadas, aguardando revisão, não encontradas, ignoradas e falhas técnicas.
- [x] Mostrar origem e até cinco alternativas com título, artista, álbum, duração, diferenças e motivo da sugestão.
- [x] Oferecer link para ouvir, somente quando validado. Preview de áudio é opcional e depende do suporte do destino.
- [x] Permitir escolher, editar título/artista da busca, pular ou informar que nenhuma opção serve.
- [x] Guardar seleções ainda não confirmadas no estado local da tela; persistir decisões confirmadas no backend.
- [x] Oferecer confirmação em lote com resumo antes da ação e feedback por faixa após a inserção.
- [x] Tratar expiração, reconexão, falha de busca e atualização concorrente sem perder a edição digitada.
- [x] Garantir teclado, foco, leitores de tela, layout móvel e mensagens PT/EN nos catálogos compartilhados.
- [x] Evitar mostrar score como porcentagem; priorizar razões compreensíveis e diferenças da gravação.

### Arquivos principais

`frontend/src/components/dashboard/ManualTrackReview.jsx`, `HistoryTab.jsx`, componentes em `components/ui/`, hooks conforme necessário e `shared/locales/pt-BR.json`/`en.json`.

### Critérios de aceite

Usuário compara versões sem depender do score. Pode selecionar várias faixas e confirmar uma vez. Erro técnico oferece recuperação apropriada. Fluxo funciona com teclado e em tela pequena, incluindo candidatos sem capa, duração ou link.

## Fase 5: relatório completo e métricas locais

### Tarefas

- [x] Versionar o relatório, mantendo interpretação documentada dos campos anteriores.
- [x] Incluir origem, destino escolhido, IDs/links, metadados, decisão, estratégia, razões e versão do algoritmo.
- [x] Distinguir aceitação automática, cache automático, escolha manual e escolha manual reaproveitada.
- [x] Separar `failed`, `retry_queued`, `needs_review`, `skipped`, `not_found`, `matched` ainda não inserido e inserção confirmada.
- [x] Incluir tentativas, motivo seguro da falha, datas disponíveis e estado de conferência do destino.
- [x] Produzir CSV legível e JSON detalhado, com proteção contra fórmulas no CSV e sem credenciais ou corpos completos de erros externos.
- [x] Informar totais da origem, faixas indisponíveis/omitidas e ausência de detalhes em registros legados.
- [x] Expor métricas locais: cobertura automática, cobertura após revisão, consultas por faixa, latência e uso de cache.
- [x] Medir precisão somente em casos com resultado esperado ou avaliação humana explícita; ausência de reclamação não equivale a acerto.

### Arquivos principais e aceite

`transferReportService.js`, `TransferMetrics.js`, Histórico e testes de relatório. Toda ocorrência deve ter resultado explicável. Somatórios devem reconciliar com as faixas persistidas, separando o total conhecido da origem. Registro antigo não recebe razões inventadas.

## Fase 6: cache de decisões e preferências

### Tarefas

- [x] Versionar o cache por algoritmo/política e invalidar entradas antigas sem evidência suficiente.
- [x] Guardar metadados e razões necessários para explicar decisões reaproveitadas.
- [x] Separar cache automático de escolhas manuais. Escolha manual não pode receber score artificial de confiança.
- [x] Isolar por identidade da gravação, destino e contexto de catálogo/conta pertinente.
- [x] Permitir esquecer uma escolha e manter alternativa rejeitada dentro do escopo apropriado.
- [x] Revalidar disponibilidade quando houver suporte; invalidar escolha se o destino rejeitar a faixa como indisponível.
- [x] Manter TTL, limites, criptografia e tolerância a falhas já presentes.

### Critérios de aceite

Cache antigo não contorna a política nova. Escolha manual de uma versão não contamina outra gravação. Falha do cache não interrompe transferência. Relatório explica o reaproveitamento e permite identificar o destino escolhido.

## Fase 7: conferência final, ordem e correção posterior

### Tarefas

- [x] Declarar por provedor capacidades de leitura do destino, reordenação, remoção e substituição.
- [x] Comparar a sequência esperada de ocorrências com a playlist lida após a escrita quando houver suporte.
- [x] Distinguir escrita aceita pela API de presença verificada no destino; não declarar conferência sem leitura.
- [x] Preservar repetições e contabilizar lacunas, extras e divergências de ordem.
- [x] Reordenar somente com capacidade verificada e proteção contra alterações concorrentes do usuário.
- [x] Onde não houver reordenação segura, oferecer criação explícita de uma nova playlist na ordem correta após a revisão. Preservar a anterior.
- [x] Planejar correção de correspondência já inserida por ocorrência, com confirmação clara da faixa afetada e capacidade do provedor.
- [x] Tratar criação remota com resposta perdida: persistir intenção/ID quando possível e sinalizar necessidade de conferência quando não houver garantia de idempotência.

### Critérios de aceite

Ordem só é declarada preservada quando verificada. Falha parcial ou retry não duplica ocorrências. Nenhuma playlist preexistente é apagada ou substituída automaticamente. Destinos com capacidade insuficiente mostram limitação e opção segura.

## Sequência de entregas

| Entrega | Dependências | Resultado revisável |
|---|---|---|
| 1. Qualidade e identidade | Fase 0 e fase 1 | Fixtures, referência e decisão comum com proteção contra falsos positivos |
| 2. Busca progressiva | Entrega 1 e fase 2 | Candidatos e fallback nos provedores, com orçamento e tratamento de falhas |
| 3. Revisão completa | Entrega 2 e fases 3/4 | Estado persistido, alternativas e confirmação em lote |
| 4. Relatórios e cache | Entrega 3 e fases 5/6 | Auditoria das decisões e reaproveitamento seguro |
| 5. Integridade no destino | Entrega 4 e fase 7 | Conferência, ordem e correção conforme capacidade |

A versão do cache deve ser invalidada já na entrega 1 se a política de aceitação mudar. A fase 6 aprofunda o recurso; não é motivo para manter cache inseguro nas entregas anteriores.

Não fixar prazo antes da fase 0 e da conferência das capacidades dos provedores. Cada entrega deve ser implementada em branch a partir da `main`, com commits por caminhos explícitos e revisão do diff. Publicação e operações em contas reais ficam fora da execução automática deste plano.

## Validação por entrega

Comandos executados para esta implementação:

```bash
cd backend
rtk test npm test
```

Quando houver mudanças em bootstrap, rotas, storage ou fila, iniciar também `npm run dev` em ambiente temporário, conferir prontidão e encerrar o processo após a validação. Não usar os dados pessoais existentes para simular interrupções.

Quando houver mudanças em React:

```bash
cd frontend
rtk test npm test
rtk test npm run test:i18n
rtk err npm run lint
rtk err npm run build
```

Reaproveitar `manual-match.test.js`, `match-cache.test.js`, `transfer-processor.test.js`, `transfer-queue-actions.test.js`, `transfer-pairs-http.test.js`, `frontend/tests/review-and-modal.test.jsx` e `history.test.jsx`. Criar testes de relatório e avaliação onde faltar cobertura.

Conferir o fluxo com `agent-browser` e a fixture de navegador em diretório temporário: busca fraca, revisão, lote, pausa, recarga, reconexão e relatório. Evidência simulada deve ser identificada como tal.

Para validar catálogo real, usar playlists pequenas e autorização explícita da conta. Registrar provedor, data, casos, resultado e limitações, sem tokens, cookies ou dados pessoais publicados. Escritas experimentais permanecem assim até confirmação real.

## Riscos e controles

| Risco | Controle |
|---|---|
| Política mais rigorosa aumentar pendências | Medir precisão e cobertura separadamente; facilitar revisão |
| Fallback multiplicar chamadas e latência | Orçamento, parada antecipada e limitador por destino |
| Metadados incompletos ou incorretos | Evidência ausente explícita; revisão quando a identidade não estiver sustentada |
| Novos estados quebrarem histórico/retomada | Leitura compatível, testes de registros antigos e recuperação no boot |
| Candidatos mudarem durante a revisão | ID do servidor, validade e revisão do conjunto |
| Lote falhar entre persistência e fila | Recuperação de escolhas pendentes e reenfileiramento idempotente |
| Cache perpetuar resultado ruim | Versão de política, escopo, invalidação e opção de esquecer |
| Reordenação sobrescrever edição do usuário | Conferência de contexto e ação explícita quando houver conflito |
| API não oferecer operação necessária | Capacidade declarada e alternativa segura, sem promessa universal |

## Fora da primeira entrega

- Busca semântica com serviço pago, modelos remotos ou envio de bibliotecas musicais a terceiros.
- Reconhecimento de áudio, downloads de músicas ou dependência de previews para decidir correspondência.
- Banco externo, infraestrutura de filas externa ou contas locais.
- Correção automática de playlists que o usuário editou após a transferência.
- Rotinas recorrentes de avaliação, sincronização ou agentes agendados.

## Resultado da execução

As 70 tarefas têm implementação ou capacidade explicitamente delimitada. Reordenação, remoção e substituição da playlist anterior permanecem desabilitadas; a alternativa implementada cria uma cópia confirmada, com ordem e correções por ocorrência. A consulta de disponibilidade do Deezer continua experimental, pois sua documentação pública não ficou acessível. Spotify tem conferência explícita de disponibilidade; os demais destinos não declaram essa capacidade.

A avaliação contém 36 casos sintéticos e não mede catálogo real. A nova política não aceitou indevidamente nenhum caso da avaliação. O cenário de navegador usa respostas simuladas e armazenamento temporário. Veja [evidência detalhada](validation-matching-quality.md).

A próxima validação externa exige uma playlist pequena e autorização explícita da conta. Não foi criado agendamento, publicação nem escrita em conta real durante esta execução.
