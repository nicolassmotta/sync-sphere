# Idiomas da interface e da API

[Índice em português](README.md) · [English documentation](en/README.md)

A interface oferece português brasileiro (`pt-BR`) e inglês (`en`). O seletor aparece na apresentação e no cabeçalho do painel. A preferência válida salva em `syncsphere-language-v1` tem prioridade; depois vêm os idiomas compatíveis do navegador. Sem idioma compatível, usa português. Se o armazenamento do navegador estiver bloqueado, a escolha funciona na sessão atual.

## Catálogos e manutenção

`shared/locales/pt-BR.json` e `shared/locales/en.json` contêm as mesmas chaves e parâmetros. A mensagem original em português é a chave. O React usa `react-i18next` para acompanhar a mudança de idioma, com recursos locais incluídos no build. Não existe serviço externo de tradução, nem alteração posterior do DOM.

Use `useText()` em componentes e hooks. Helpers puros podem usar `translate`. Traduza mensagens próprias no momento da apresentação; não use texto traduzido como chave React, identificador de provedor ou estado persistido. Nomes de playlists, artistas, músicas, descrições e nomes de conta são dados, não mensagens traduzíveis.

Mensagens legadas de progresso podem chegar interpoladas pelo Socket.io. O localizador compartilhado reconhece somente padrões dos catálogos, compilados uma vez, com comparação ancorada e tamanho limitado. `shared/messageParameters.js` identifica explicitamente parâmetros que são labels de provedores, gramática ou mensagens próprias. Os demais parâmetros permanecem intactos. Novas mensagens devem preferir template e parâmetros explícitos; mensagens externas desconhecidas continuam no idioma original.

```bash
npm run test:i18n --prefix frontend
npm test
npm run lint
npm run build
```

O teste dos catálogos confere paridade e placeholders. Os testes também verificam a preservação de valores que coincidem com labels traduzíveis, como uma música chamada `Arquivo`.

## Contrato HTTP e progresso

O cliente envia `Accept-Language`. A API negocia `pt-BR` ou `en` por prioridade e responde com `Content-Language` e `Vary: Accept-Language`. Sem preferência compatível, usa português. A tradução altera somente campos próprios permitidos, como `message`, `lastMessage`, `lastError` e labels de autenticação. Status HTTP, enums, IDs e metadados permanecem iguais. Logs operacionais e registros persistidos continuam em português.

CSV e JSON do relatório seguem o idioma solicitado para cabeçalhos, resultado por faixa e nota. Chaves técnicas JSON e metadados não mudam. Exportações de playlists não passam pelo tradutor. A troca de idioma mantém seleção, histórico e jobs; o acompanhamento por Socket.io mantém a assinatura existente e apresenta as mensagens no idioma atual, sem criar outra transferência ou repetir a notificação de conclusão.

## Conteúdo público e limites

O README principal e os guias iniciais em `docs/en/` estão em inglês. `README.pt-BR.md` e os guias originais mantêm português. Arquitetura, API, notas detalhadas, divulgação e manutenção ainda estão em português, identificados no índice em inglês. Não declare tradução completa de todo o repositório.

O vídeo foi gravado com a interface em português e possui legendas PT/EN. Os nomes dos iniciadores e seus prompts de terminal permanecem em português, inclusive a confirmação literal `RESTAURAR`. Essa instrução aparece no guia em inglês. Pacotes precisam incluir `shared/`, pois a API também usa os catálogos.
