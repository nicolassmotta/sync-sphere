# Política de Skills

Objetivo: manter o conjunto de skills enxuto e útil para o SyncSphere.

## Sempre Usar

- `sync-sphere`: skill local obrigatória para qualquer implementação, revisão, debug, documentação ou planejamento neste repo.

## Usar Somente Quando Necessário

- `openai-docs`: dúvidas atuais sobre APIs/produtos OpenAI.
- `github:*`: PRs, issues, revisões, CI ou publicação no GitHub.
- `figma:*`: implementação ou geração de design a partir de Figma.
- `imagegen`: criação/edição de assets bitmap.
- `skill-creator` ou `plugin-creator`: manutenção real de skills/plugins.
- `skill-installer`: instalar skills externas sob pedido explícito.
- `meeting-notes-and-actions`: resumir reuniões/transcrições.

## Não Manter como Padrão do Projeto

Skills genéricas de automação, marketing, vendas, suporte, planilhas, Slack/Notion ou pesquisa externa não devem ser carregadas por padrão. Use apenas se a tarefa pedir diretamente.

O clone local `awesome-codex-skills/`, quando existir, é apenas referência e não faz parte das skills obrigatórias do SyncSphere.

## Revisão Atual

- Skill local mantida: `.agents/skills/sync-sphere/`.
- Nenhuma skill local removida; não havia skills locais redundantes no projeto.
- `caveman` e `rtk` foram adicionados como referências em `agent-repos/`, não como skills obrigatórias copiadas para `.agents/skills/`.
- A regra obrigatória de uso está em `AGENTS.md` e `docs/ai/agent-tooling.md`, para funcionar também com agentes que não suportam o mesmo sistema de skills do Codex.
