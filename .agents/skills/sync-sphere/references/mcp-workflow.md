# Referência de Fluxo MCP

Prefira MCPs que exponham fontes reais de verdade com permissões estreitas.

MCPs recomendados:

- filesystem para a raiz local do repositório clonado;
- git depois que o projeto estiver inicializado como repositório;
- browser/playwright para verificação de UI;
- figma apenas quando um arquivo de design fizer parte da tarefa;
- github apenas depois que existir remoto.

O projeto é local-first e não usa MongoDB nem Redis, então não há MCP de banco ou de fila.

Segurança:

- nunca exponha valores de `.env`, cookies, tokens Spotify ou o conteúdo de `backend/data/`;
- use dados locais/de desenvolvimento por padrão;
- não apague `backend/data/` (credenciais e histórico locais) sem confirmação explícita;
- documente novos usos recorrentes de MCP em `docs/ai/mcp-catalog.md`.
