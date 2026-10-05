# Validação de integridade e recuperação

[Arquitetura](architecture.md) | [Uso](usage.md)

Verificação local em 01/10/2026, com Node.js 24.15.0. Dados, chaves e respostas de plataformas usados nas reproduções são fictícios. Nenhuma escrita em conta externa foi realizada.

## Regressões

Antes das correções, cinco testes novos falharam nos cenários de corrupção, retry de inserção, publicação terminal prematura, snapshot cortado e leitura integral do cache por acerto.

- `json-store.test.js`, `storage-integrity.test.js` e `health.test.js`: arquivo ausente, leitura correta, bloqueio após corrupção, troca de chave em processo separado para todas as sete coleções essenciais, tentativa normal de `Transfer.insertMany`, chave local inválida e prontidão 503. As comparações de `Buffer` verificam preservação byte por byte. Os testes anteriores de renomeação atômica e permissão 0600 continuam passando.
- `transfer-queue-actions.test.js`: retry de `matched` sem inserção conserva metadados manuais e playlist; retry geral inclui esse trabalho; job existente ou solicitação simultânea não modifica o checkpoint; falha anterior à leitura continua recuperável. Histórico antigo calcula inserções pendentes sem regravar registros.
- `transfer-processor.test.js`: reconciliação depois de escrita parcial com a sequência `A, B, A`, preservando a ocorrência confirmada e acrescentando somente a repetição ausente. Não há nova busca nem criação de playlist. Integração com trabalhador e fila reais verifica pausa após 503, `resumeAt` igual ao job persistido, sucesso na próxima tentativa, falha final após três tentativas e erro irrecuperável sem reagendamento. Rate limit, reconexão e retry por faixa mantêm seus testes próprios.
- Testes dos provedores: corte por paginação ou slice, preservação de total e omissões e distinção de itens indisponíveis/não suportados. Snapshot com três faixas originais e uma lida é recusado antes de busca/criação. Snapshot completo ou total desconhecido sem corte continua processável.
- `match-cache.test.js` e `storage-integrity.test.js`: cache cifrado reutilizado em outro processo, TTL de sete dias, máximo de 5.000 entradas, atualização compartilhada entre destinos, checkpoints, falha tolerante e ausência de leituras de arquivo durante uma sequência de acertos com índice carregado.

## Comandos e resultados

| Verificação | Resultado observado |
|---|---|
| `cd backend && npm test` | 225 testes em 23 suítes passaram. |
| `cd frontend && npm run lint` | Passou, sem erros. |
| `cd frontend && npm run build` | Passou, 2.291 módulos transformados. |
| `npm audit --omit=dev --json`, em backend e frontend | Zero vulnerabilidades de produção em ambos. |
| `npm run dev`, com DATA_DIR temporário, porta livre e credenciais fictícias | `/api/health` e `/api/ready` responderam 200. Apenas o grupo de processos iniciado para esse teste foi encerrado. |
| Inicialização com `transfers.json` corrompido no mesmo diretório temporário | Processo encerrou com código 1 antes de escutar; arquivo preservado e orientação de recuperação presente. |
| `git diff --check` | Sem erros. |
| Links locais e âncoras dos guias alterados | Sem referências quebradas. |

Para repetir um bootstrap isolado, defina `DATA_DIR` para um diretório temporário, `ENCRYPTION_KEY` fictícia válida, porta livre e `DOTENV_CONFIG_PATH` para um arquivo de ambiente fictício. Essa variável evita carregar o `.env` da instalação existente. Não use o diretório de dados habitual nas reproduções.

## Benchmark do cache

O script [benchmark-match-cache.mjs](../backend/scripts/benchmark-match-cache.mjs) cria 5.000 entradas cifradas em diretório temporário e executa o `TrackMatcher` sobre 1.000 acertos. A preparação das entradas fica fora do intervalo medido; a carga inicial do índice está dentro. Uma busca externa inesperada interrompe a medição.

```bash
node backend/scripts/benchmark-match-cache.mjs
```

| Implementação | Tempo de 1.000 acertos | Atraso do timer de 0 ms |
|---|---:|---:|
| Antes, reprodução nesta execução | 3.160,6 ms | 3.161,0 ms |
| Depois, script isolado nesta execução | 11,0 ms | 11,4 ms |

Outra amostra após a correção mediu 13,6 ms e 14,0 ms. Esses valores são observações desta máquina, sem garantia universal. Os testes verificam invariantes de leitura e persistência, sem limite de milissegundos.

## Conferência no navegador

Sessão própria de `agent-browser`, com frontend compilado, API, fila, trabalhador e Socket.io reais. O destino Arquivo usa dados temporários; sua primeira inserção foi instrumentada para lançar 503. O snapshot cortado também foi simulado. Chamadas externas foram bloqueadas nesse processo demonstrativo.

O Histórico mostrou uma inserção pendente com correspondência preservada, `0/1/1` em migradas/total/pendentes e a ação **Tentar todas**. A execução publicou `processing -> paused -> processing -> completed`. A interface mostrou **Pausada**, motivo do 503 e contagem até a retomada, depois **Sucesso**. O registro do socket confirmou desconexão somente depois do evento `completed`.

O relatório do snapshot cortado mostrou uma faixa migrável lida de três, duas omissões e instrução para dividir a playlist, sem destino criado. Nenhum erro de JavaScript foi observado pelo navegador nesse fluxo.

## Limites de validação

Escritas remotas foram verificadas com respostas simuladas, sem contas reais. A janela entre criar uma playlist remota e persistir seu ID continua sem transação distribuída e pode exigir conferência manual após interrupção. O cache é compartilhado entre raias de um único processo; múltiplos processos escritores no mesmo DATA_DIR continuam fora do modelo suportado. A versão 1.1.0 permanece em preparação, sem tag ou publicação de release.
