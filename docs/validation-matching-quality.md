# Validação de correspondência robusta

[Índice](README.md) · [Plano executado](plano-correspondencia-robusta.md)

Data: 04/10/2026. Ambiente: Node.js local, armazenamento temporário cifrado e respostas de provedores simuladas. Nenhuma operação em conta real faz parte desta evidência.

## Referência de qualidade

A amostra tem 36 casos sintéticos: quatro de ajuste e 32 de avaliação. Cobre artista errado, participações, alias explícito, Unicode, versões, conteúdo explícito/limpo, duração ausente/divergente, ISRC, indisponibilidade, empate e repetições. Os resultados anteriores foram medidos com os comparadores da revisão `3b0302a` e estão congelados em `backend/tests/fixtures/matching/baseline.json`.

Resultado na amostra de avaliação:

| Política | Aceitas corretamente | Aceitas indevidamente | Abstenções | Precisão nas aceitações | Cobertura automática |
|---|---:|---:|---:|---:|---:|
| Comparador compartilhado anterior | 8 | 19 | 5 | 29,6% | 84,4% |
| Spotify anterior | 10 | 21 | 1 | 32,3% | 96,9% |
| YouTube Music anterior | 10 | 21 | 1 | 32,3% | 96,9% |
| Política `identity-v2` | 10 | 0 | 22 | 100% | 31,3% |

As 22 abstenções da política nova incluem 21 casos para revisão e um catálogo vazio. A amostra contém muitos casos adversos deliberadamente. Esses percentuais não estimam precisão ou cobertura em bibliotecas reais. Não existe meta numérica de cobertura em catálogo real definida por esta avaliação. Casos adicionais de regressão verificam placeholders de artista e palavras como “Cover” dentro do próprio título.

Reproduzir:

```bash
node backend/scripts/evaluate-matching-quality.mjs
cd backend
rtk test npm test -- --runTestsByPath tests/matching-quality.test.js tests/search-orchestrator.test.js
```

## Política adotada

A aceitação automática exige título comparável não vazio e equivalente, artistas identificados e compatíveis, versão compatível, ausência de conflito de ISRC, disponibilidade não explicitamente negada e ausência de conflito de conteúdo explícito/limpo. Diferença de duração acima de 15 segundos impede aceitação. Duração desconhecida permanece ausente na evidência; título e artista exatos podem sustentar aceitação sem duração.

O score é uma escala de evidência. O mínimo é 90 e a margem mínima entre dois candidatos elegíveis é oito pontos. Nenhum score é mostrado como probabilidade. IDs repetidos são deduplicados; duas opções elegíveis de IDs distintos sem margem suficiente vão para revisão. Remixes, edições e remasterizações conservam a identidade detalhada da versão. Aliases só são aceitos quando explicitamente fornecidos pela origem; não há catálogo inventado de pseudônimos.

## Busca e limites

Os seis destinos remotos oferecem `searchCandidates`. A busca comum tenta ISRC onde declarado, consulta completa, texto normalizado, artista principal, álbum e título amplo. YouTube Music pode ampliar para vídeos. Arquivo preserva os metadados sem busca remota.

O orçamento padrão por faixa é de seis estratégias, 12 requisições HTTP instrumentadas, 15 segundos por consulta e 30 segundos por execução da busca. O orçamento de chamadas é persistido entre retomadas automáticas. Esgotamento com falha técnica termina como falha; um retry explícito renova o orçamento e preserva estratégias concluídas, mantendo a contagem acumulada no relatório. Token e descoberta de cliente feitos dentro da busca também consomem chamadas. `fetch` recebe cancelamento e o cliente Axios do YouTube Music recebe interceptor de orçamento. O espaçamento é compartilhado por destino/contexto de catálogo, inclusive entre buscas concorrentes.

Erros técnicos não viram catálogo vazio. Estratégias concluídas e até cinco candidatos persistem no checkpoint. Mudanças de algoritmo, identidade ou contexto de catálogo invalidam a retomada. Autenticação e rate limit seguem o fluxo existente de reconexão e pausa, com `Retry-After`.

Referências consultadas: [busca Spotify](https://developer.spotify.com/documentation/web-api/reference/search), [faixa Spotify e disponibilidade](https://developer.spotify.com/documentation/web-api/reference/get-track), [Songs na Apple Music API](https://developer.apple.com/documentation/applemusicapi/songs-api), [referência TIDAL](https://developer.tidal.com/reference) e [implementação ytmusic-api](https://github.com/zS1L3NT/ts-npm-ytmusic-api). Deezer e SoundCloud mantêm os endpoints já usados pelos adaptadores. A documentação pública do Deezer não ficou acessível nesta verificação; sua leitura de `readable` permanece experimental. A API do site SoundCloud e a biblioteca YouTube Music são integrações não oficiais; nenhum suporte a filtros adicionais foi presumido.

## Revisão, cache e relatório

A revisão gera UUIDs por faixa, validade de dez minutos e revisão do conjunto. O lote valida todas as escolhas antes de gravar, usa trava compartilhada com retry e agenda um único job. Confirmação repetida preserva idempotência. Escolhas gravadas que ficaram sem job são recuperadas no boot. Registros antigos continuam legíveis, com evidência ausente explícita. Correspondências automáticas antigas ainda não inseridas voltam para revisão; escolhas manuais explícitas e ocorrências já inseridas são preservadas.

O cache usa a versão da política, identidade completa, artistas, duração, conteúdo explícito, destino e contexto de credenciais/catalogação. Entradas automáticas são reavaliadas; escolhas manuais guardam decisão explícita e `matchScore: null`. Alteração de credenciais pode reduzir reaproveitamento, evitando cruzar contas. Disponibilidade é reconsultada no Spotify e Deezer; os demais adaptadores não declaram essa capacidade. Rejeição de disponibilidade na inserção invalida o cache e volta para revisão. Ignorar registra as alternativas rejeitadas somente naquela ocorrência. “Esquecer escolha futura” remove o reaproveitamento sem alterar a playlist.

O relatório v2 mantém os campos básicos anteriores, acrescenta metadados, evidências, decisão, versão, estratégias, consultas, requisições, latência, datas e conferência do destino. CSV mantém proteção contra fórmulas. Erros externos entram por categoria segura, sem corpos completos. A precisão no relatório de uma transferência comum fica `null`; o aplicativo não interpreta ausência de reclamação como acerto.

## Integridade do destino

Os sete adaptadores têm leitura do destino. A conferência compara quantidades e sequência das ocorrências resolvidas, incluindo repetições. Uma escrita aceita pela API e uma presença verificada têm estados diferentes. Falha de leitura conserva `unverified`; diferenças conservam `diverged`, lacunas, extras e informação de ordem.

Reordenação, remoção e substituição de ocorrências na playlist original não são capacidades habilitadas. A alternativa oferecida é criar uma nova playlist na ordem da origem depois de resolver ou ignorar todas as pendências. A correção de uma faixa já inserida seleciona uma alternativa com UUID/revisão e a aplica somente à ocorrência correspondente na cópia confirmada. A playlist anterior é preservada. Uma criação sem resposta conhecida deixa intenção persistida e exige conferência antes de outra criação.

## Evidência de interface simulada

A fixture `backend/tests/fixtures/browser-server.mjs` bloqueia rede externa e exige `DATA_DIR` temporário. O cenário `robust-review` produz alternativas ambíguas. No navegador foram selecionadas duas ocorrências e confirmado um lote. O relatório mostrou duas inserções, uma pendência de revisão e sequência verificada pelo destino simulado. A fixture foi reiniciada com o mesmo diretório e conservou escolhas e pendências.

Os testes de interface cobrem comparação, seleção por teclado, erros de busca, confirmação em lote e preservação de idioma/metadados. Os testes de backend cobrem orçamento HTTP, fallback fraco, empate, checkpoint, timeout, lotes inválidos, UUIDs expirados/de outra faixa, recuperação, cache e correção em cópia. A conferência manual de catálogo real permanece pendente de autorização e credenciais.

## Checks finais

Executados nesta sessão:

| Comando | Resultado |
|---|---|
| `rtk test npm test --prefix backend` | 38 suítes, 514 testes aprovados |
| `rtk test npm test --prefix frontend` | 5 arquivos, 24 testes aprovados |
| `rtk test npm run test:i18n --prefix frontend` | Aprovado, zero falhas |
| `rtk err npm run lint --prefix frontend` | Sem erros |
| `rtk err npm run build --prefix frontend` | Build concluído |
| `npm run dev --prefix backend` com `DATA_DIR` temporário | Servidor/fila iniciados; `/api/ready` retornou `ready` |
| `git diff --check` | Sem erros |

O navegador percorreu seleção em lote, inserção posterior da ocorrência repetida, recarga, reinício e criação de cópia ordenada. Origem e cópia terminaram com três ocorrências e conferência de sequência aprovada pelo destino simulado. Em viewport de 390 x 844 não houve transbordamento horizontal. A auditoria `agent-browser a11y --tags wcag2a,wcag2aa` retornou zero violações, 25 verificações aprovadas e um item de contraste incompleto, que não equivale a uma aprovação automática de contraste.
