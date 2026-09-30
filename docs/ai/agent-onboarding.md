# Checklist de Entrada para Agentes

Use este checklist no início de uma sessão nova.

1. Ler `AGENTS.md`.
2. Ler `docs/ai/project-context.md` se a tarefa envolver arquitetura, back-end, front-end, storage local, fila ou integrações.
3. Ler `docs/ai/agent-tooling.md` e `docs/ai/skill-policy.md` para aplicar Caveman/RTK e carregar somente skills relevantes.
4. Consultar `docs/ai/mcp-catalog.md` se precisar de acesso a navegador, Figma ou GitHub.
5. Usar `docs/ai/prompt-recipes.md` para tarefas repetidas.
6. Verificar scripts reais em `backend/package.json` e `frontend/package.json` antes de rodar comandos.
7. Se `rtk` estiver instalado, preferir comandos compactados para saídas grandes; se não estiver, seguir com comandos normais.
8. Evitar segredos: não imprimir `.env`, cookies, tokens ou dados reais.
9. Validar no escopo certo: back-end para API/fila/storage; front-end para UI/rotas/build.
10. Em documentação pública, usar `docs/README.md` como índice; verificar fatos contra o código e regras externas contra fontes oficiais. Registrar se uma validação foi simulada ou confirmada numa conta.
