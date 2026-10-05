# Fases do SyncSphere

[Índice da documentação](README.md)

O objetivo é migrar playlists entre os provedores suportados, mantendo execução local, fila persistida e credenciais cifradas.

O ciclo de [correspondência robusta](plano-correspondencia-robusta.md) está implementado e validado localmente. Inclui decisão comum, fallback progressivo, revisão em lote, relatório v2, cache de escolhas e conferência do destino. A [evidência e as limitações](validation-matching-quality.md) separam testes sintéticos de operações em contas reais.

| Fase | Escopo | Estado |
|---|---|---|
| 1 | Progresso, ETA, pausas, reconexão e pendências | Integrada |
| 2 | Contrato único de provedores e escolha de origem/destino | Integrada |
| 3 | Arquivo, Deezer, TIDAL, Apple Music e SoundCloud | Integrada |
| 4 | Cache de correspondências e revisão manual de faixas | Integrada |
| 5 | Fidelidade das ocorrências, reconciliação de retomadas e escrita local atômica | Integrada |
| 6 | Documentação de contribuição e preparação da versão 1.1.0 | Preparada, publicação pendente |

## Fase 4

O cache cifrado reutiliza correspondências confiáveis por sete dias. Faixas ambíguas, não encontradas ou com falha definitiva podem receber uma busca ajustada no Histórico. A pessoa compara até cinco alternativas e confirma escolhas em lote.

## Fase 5

Os destinos recebem a lista completa das ocorrências resolvidas e comparam quantidades com o conteúdo existente. Isso permite preservar repetições intencionais e retomar uma escrita parcial. Arquivos exportados são reconstruídos na ordem da origem.

O storage sincroniza um temporário antes de substituir o arquivo anterior. Falhas de leitura do destino interrompem inserções. Limites de Arquivo e SoundCloud geram erros explícitos.

## Fase 6

Preparar a versão 1.1.0 com documentação atualizada, guias de contribuição e segurança, templates de PR e issue, dependências corrigidas e validação de testes, lint, build, auditoria e aplicação empacotada.

As notas estão em [releases/v1.1.0.md](releases/v1.1.0.md). Publicar tag e GitHub Release é uma etapa posterior à preparação.

A documentação pública está organizada por instalação, integração, uso, configuração, arquitetura e API. As capturas e os textos de apresentação ficam em [media-kit.md](media-kit.md).

## Validações externas pendentes

A escrita real em Deezer, TIDAL, Apple Music e SoundCloud precisa de credenciais da conta e de uma playlist pequena de teste. Testes automatizados usam respostas simuladas e não substituem essa confirmação.

Retomadas em destinos remotos acrescentam faixas recuperadas ao fim da playlist. A ordem exata após buscas tardias pode diferir da origem. O aplicativo lê o destino para verificar ocorrências e oferece uma nova playlist ordenada, sem modificar a anterior. A criação de uma playlist remota também depende do comportamento de cada API; uma interrupção imediatamente após sua criação pode exigir conferência manual antes de tentar novamente.


## Primeira experiência

Fluxo guiado, demonstração integrada, assistentes de conexão, relatórios, ajuda por sintoma, diagnóstico revisável, backup protegido e geração de pacotes portáteis estão implementados. A interface PT/EN, o README em inglês e os guias iniciais traduzidos também estão implementados. Referências técnicas completas e prompts de terminal permanecem em português. Veja [idiomas](localization.md).

O Histórico oferece filtros de atenção, andamento e conclusão, combinados com busca por playlist. O resultado abre nas faixas que precisam de revisão ou, quando não há pendências, nas adicionadas. A revisão compara metadados e mostra as alternativas escolhidas antes da confirmação em lote. Correções e preferências ficam em uma seção expansível. A validação visual usa dados demonstrativos e provedores simulados.

Além da confirmação real das integrações, ficam pendentes a execução dos pacotes em sistemas/arquiteturas não disponíveis na máquina de desenvolvimento, sessões de usabilidade com participantes reais e eventual assinatura de instaladores. O [roteiro de conferência](usability-testing.md) descreve como obter evidência sem pedir credenciais aos participantes.
