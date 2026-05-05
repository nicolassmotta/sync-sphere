# Referência de Fluxo MCP

Prefira MCPs que exponham fontes reais de verdade com permissões estreitas.

MCPs recomendados:

- filesystem para `/home/nicolasmotta/sync-sphere`;
- git depois que o projeto estiver inicializado como repositório;
- mongodb para inspecionar o `syncsphere` local;
- redis para inspecionar BullMQ local;
- browser/playwright para verificação de UI;
- figma apenas quando um arquivo de design fizer parte da tarefa;
- github apenas depois que existir remoto.

Segurança:

- nunca exponha valores de `.env`, cookies, JWTs, tokens Spotify ou cookies do YouTube;
- use dados locais/de desenvolvimento por padrão;
- não limpe filas Redis ou coleções Mongo sem confirmação explícita;
- documente novos usos recorrentes de MCP em `docs/ai/mcp-catalog.md`.
