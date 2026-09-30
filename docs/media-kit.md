# Materiais de divulgação

[Índice da documentação](README.md)

Use estes textos e imagens para apresentar o projeto em posts, portfólio, comunidades e demonstrações. O estado desta documentação é a `main`, com a versão 1.1.0 preparada e ainda não publicada.

## Nome e descrição curta

**SyncSphere**

> Migrador local de playlists entre plataformas de música e arquivos, com progresso, retomada e revisão manual.

Frase de apresentação:

> Suas playlists entre plataformas, na sua máquina.

Repositório: [github.com/nicolassmotta/sync-sphere](https://github.com/nicolassmotta/sync-sphere).

## Apresentação para portfólio

> SyncSphere é um projeto de código aberto que migra playlists entre Spotify, YouTube Music, Deezer, TIDAL, Apple Music, SoundCloud e arquivos CSV, JSON, M3U ou TXT. O aplicativo roda na máquina da pessoa, mantém dados cifrados e acompanha cada transferência em um painel React. A fila persiste entre reinícios, o cache reduz buscas repetidas e o Histórico permite revisar músicas não encontradas. A arquitetura usa adaptadores de provedores para evoluir as integrações sem concentrar regras no fluxo de transferência.

## Texto para uma publicação

> Estou desenvolvendo o SyncSphere, um migrador local e de código aberto de playlists. Ele reúne sete provedores, conversão de arquivos, progresso em tempo real, retomada de transferências e revisão manual de faixas. Dá para experimentar Arquivo -> Arquivo sem conectar contas de música. A versão 1.1.0 está preparada na main; algumas escritas externas ainda precisam de validação com contas reais. Código, documentação e formas de contribuir: https://github.com/nicolassmotta/sync-sphere

Antes de publicar, ajuste a pessoa verbal e o estado da versão para refletir quem está apresentando e o que foi publicado. Este arquivo contém textos prontos, não publicações enviadas.

## Imagens

| Material | Arquivo | Uso |
|---|---|---|
| Logo | [favicon.svg](../frontend/public/favicon.svg) | Identificação do projeto em tamanhos pequenos. |
| Página inicial | [JPEG para web](assets/overview.jpg) · [PNG](assets/overview.png) | Apresentação dos provedores e do fluxo local. |
| Painel | [dashboard.png](assets/dashboard.png) | Apresentação da escolha de provedores e seleção de playlist. |
| Histórico | [history.png](assets/history.png) | Resultado de conversão e saída disponível. |
| Revisão manual | [manual-review.png](assets/manual-review.png) | Demonstração da escolha de alternativa em tela pequena. |

As capturas usam o aplicativo em uma instalação isolada. Painel e Histórico foram capturados durante uma conversão real de Arquivo -> Arquivo com as três faixas fictícias do exemplo. A imagem de revisão manual usa uma resposta externa simulada. Não apresente esses materiais como comprovação de escrita em contas reais.

## Roteiro de demonstração

1. Mostre a lista de sete provedores no Início.
2. Escolha Arquivo como origem e destino.
3. Importe [a playlist de exemplo](examples/playlist.csv), selecione-a e inicie a conversão.
4. Mostre o progresso e o resultado no Histórico.
5. Baixe o JSON ou CSV e confira as três faixas.
6. Explique a configuração opcional dos serviços de música, o cache e a revisão manual.

Essa demonstração é reproduzível sem credenciais de terceiros. Para demonstrar escrita em uma plataforma real, valide a conta e uma playlist pequena antes de gravar e remova credenciais das imagens.

## Afirmações que refletem o projeto

- Código aberto sob licença MIT.
- Aplicação local para uma pessoa, com credenciais e dados cifrados.
- Sete provedores registrados com capacidades de leitura e escrita.
- Conversão Arquivo -> Arquivo sem contas de serviços.
- Fila persistida, progresso Socket.io, cache e revisão manual.
- Testes automatizados com respostas simuladas para integrações externas.

O catálogo e a autenticação condicionam o resultado. A versão 1.1.0 ainda não foi publicada, e a escrita real em Deezer, TIDAL, Apple Music e SoundCloud permanece pendente de confirmação com credenciais. Evite promessas de correspondência perfeita, funcionamento totalmente offline ou compatibilidade irrestrita com qualquer serviço.

## Participação

Para convidar contribuições, use [CONTRIBUTING.md](../CONTRIBUTING.md), o [plano das fases](roadmap.md) e as [issues](https://github.com/nicolassmotta/sync-sphere/issues). A política de relato de vulnerabilidades está em [SECURITY.md](../SECURITY.md).
