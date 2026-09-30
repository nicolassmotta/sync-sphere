# Fases do SyncSphere

O objetivo é migrar playlists entre os provedores suportados, mantendo execução local, fila persistida e credenciais cifradas.

| Fase | Escopo | Estado |
|---|---|---|
| 1 | Progresso, ETA, pausas, reconexão e pendências | Integrada |
| 2 | Contrato único de provedores e escolha de origem/destino | Integrada |
| 3 | Arquivo, Deezer, TIDAL, Apple Music e SoundCloud | Integrada |
| 4 | Cache de correspondências e revisão manual de faixas | Integrada |
| 5 | Fidelidade das ocorrências, reconciliação de retomadas e escrita local atômica | Integrada |
| 6 | Documentação de contribuição e preparação da versão 1.1.0 | Preparada, publicação pendente |

## Fase 4

O cache cifrado reutiliza correspondências confiáveis por sete dias. Faixas não encontradas ou com falha definitiva podem receber uma busca ajustada no Histórico. A pessoa confere a proposta e confirma a inserção na playlist.

## Fase 5

Os destinos recebem a lista completa das ocorrências resolvidas e comparam quantidades com o conteúdo existente. Isso permite preservar repetições intencionais e retomar uma escrita parcial. Arquivos exportados são reconstruídos na ordem da origem.

O storage sincroniza um temporário antes de substituir o arquivo anterior. Falhas de leitura do destino interrompem inserções. Limites de Arquivo e SoundCloud geram erros explícitos.

## Fase 6

Preparar a versão 1.1.0 com documentação atualizada, guias de contribuição e segurança, templates de PR e issue, dependências corrigidas e validação de testes, lint, build, auditoria e aplicação empacotada.

As notas estão em [releases/v1.1.0.md](releases/v1.1.0.md). Publicar tag e GitHub Release é uma etapa posterior à preparação.

## Validações externas pendentes

A escrita real em Deezer, TIDAL, Apple Music e SoundCloud precisa de credenciais da conta e de uma playlist pequena de teste. Testes automatizados usam respostas simuladas e não substituem essa confirmação.

Retomadas em destinos remotos acrescentam faixas recuperadas ao fim da playlist. A ordem exata após buscas tardias pode diferir da origem. A criação de uma playlist remota também depende do comportamento de cada API; uma interrupção imediatamente após sua criação pode exigir conferência manual antes de tentar novamente.
