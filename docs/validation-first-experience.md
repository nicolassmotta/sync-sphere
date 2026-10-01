# Validação da primeira experiência

[Arquitetura](architecture.md) | [Primeira migração](primeira-migracao.md) | [Distribuição](distribution.md)

Conferência local em 01/10/2026, com Node.js 24.15.0. As reproduções usam diretórios temporários, credenciais fictícias e sessões próprias de navegador. Não houve escrita em contas externas nem alteração dos dados da instalação existente.

## Resultados observados

| Verificação | Resultado |
|---|---|
| `npm test` | 241 testes em 25 suítes passaram. |
| `npm run lint` e `npm run build` | Passaram. |
| `npm audit --omit=dev --json`, em backend e frontend | Zero vulnerabilidades de produção em ambos. |
| `npm run dev`, DATA_DIR temporário e porta 18944 | Saúde e prontidão responderam 200. |
| Fluxo no navegador, Arquivo para Arquivo | Três ocorrências adicionadas, com a repetição preservada. |
| Relatórios baixados pelo painel | JSON confirmou três inserções; CSV continha cabeçalho e três linhas; playlist JSON preservou a repetição. |
| Backup baixado pelo painel e restaurado pelo CLI | Importação, exportação e três faixas recuperadas em outro diretório com outra chave local. |
| Client ID do Spotify no assistente | Valor inválido recusado; valor fictício de 32 caracteres aceito sem editar o .env. |
| Erro 401 simulado ao conectar YouTube Music | Erro apresentado na mesma tela; sem redirecionar para login próprio. |
| Tela de 390 por 844 pixels | Sem transbordamento horizontal; resultado e ajuda acessíveis. |
| Auditoria automática de acessibilidade | Zero violações nos cenários finais de ajuda, resultado móvel e conexão. Há itens que dependem de avaliação manual. |
| Vídeo local | Gravação de 14,7 segundos com dados fictícios, cópias WebM/MP4, legendas e descrição textual. |
| `git diff --check` e links locais dos guias | Sem erros. |

A conferência por teclado verificou digitação da senha sem perder foco, navegação entre campos e isolamento do conteúdo de fundo do modal. As abas de detalhes oferecem setas, Home e End. A preferência por movimento reduzido é respeitada; o texto das páginas aparece imediatamente.

## Backup e integridade

Os testes de suporte cobrem senha incorreta, pacote alterado, bloqueio com fila pendente, reversão após falha parcial, recuperação pelo diário cifrado, bloqueio exclusivo e recusa de endereço remoto mesmo com cabeçalho simulando loopback. O teste em processo separado restaura um backup com outra chave local e confere que os dados permanecem cifrados.

Diagnóstico usa somente campos permitidos. Testes verificam ausência de credenciais fictícias, nomes privados de playlists e caminhos de dados. Relatórios neutralizam fórmulas em células CSV e distinguem correspondência encontrada de inserção confirmada.

O iniciador é testado em uma instalação temporária: preserva o .env existente, reutiliza a instância correta e recusa outra instalação que ocupe a mesma porta. O status do Spotify informa a ausência de Client ID para apresentar o assistente inicial.

## Pacotes portáteis

```bash
npm run package -- --all
```

Foram gerados seis pacotes locais: Linux x64/ARM64, macOS x64/ARM64 e Windows x64/ARM64. As seis somas SHA-256 dos artefatos foram conferidas. Os runtimes também são verificados contra as somas oficiais antes da montagem.

O pacote Linux x64 foi extraído em diretório temporário e executado com o Node.js incluído, sem usar o runtime do sistema. Saúde e prontidão responderam 200; a API criou a demonstração e o trabalhador concluiu as três ocorrências. O relatório confirmou inserção e repetição. Apenas o processo de teste iniciado foi encerrado.

A primeira conferência detectou links absolutos de dependências apontando para a área temporária de montagem. O empacotamento foi corrigido para preservar links relativos; a extração segura e a execução passaram depois dessa correção. A lista do pacote foi conferida sem .env, dados ou logs da instalação.

## Limites

A geração dos outros cinco pacotes não comprova execução em seus sistemas e arquiteturas. Essa conferência, a assinatura de instaladores, testes com participantes reais e a validação de escrita nas integrações experimentais continuam pendentes.

O erro 401 foi simulado em um servidor isolado, com rede externa bloqueada. A demonstração Arquivo para Arquivo, relatórios e backup usam as implementações reais. Nenhum resultado acima comprova escrita real nas contas de música.

A interface permanece em português; tradução é uma etapa posterior. Nenhuma tag ou GitHub Release foi publicada, e a versão 1.1.0 continua em preparação.
