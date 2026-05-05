---
name: sync-sphere
description: Orientações específicas para trabalhar no SyncSphere, app React/Vite + Node/Express para migrar playlists do Spotify para o YouTube Music. Use quando Codex precisar implementar, revisar, depurar, documentar ou planejar mudanças neste repositório, especialmente em tarefas envolvendo cookies de autenticação, MongoDB/Mongoose, filas Redis/BullMQ, progresso via Socket.io, integrações Spotify/YouTube Music, UI Tailwind, configuração MCP ou contexto reutilizável para agentes.
---

# Sync Sphere

## Visão Geral

Use esta skill para trabalhar no repositório SyncSphere com o contexto do projeto já carregado. Prefira mudanças concisas e nativas do repositório, preserve as decisões de autenticação, fila e segurança, e atualize os documentos de contexto de IA quando surgir conhecimento recorrente.

## Início Rápido

1. Leia `AGENTS.md` na raiz do repositório.
2. Leia `docs/ai/project-context.md` para arquitetura, portas, convenções e mapa de arquivos.
3. Leia `docs/ai/agent-tooling.md` e `docs/ai/skill-policy.md` para comportamento de agentes, uso de Caveman/RTK e escopo de skills.
4. Leia `docs/ai/mcp-catalog.md` quando a tarefa precisar de MCPs ou ferramentas externas.
5. Leia `docs/ai/prompt-recipes.md` quando a tarefa for um fluxo recorrente.
6. Use os scripts do subprojeto relevante antes de inventar comandos.

## Regras do Projeto

- Mantenha o back-end em ESM.
- Mantenha JWT em cookies HttpOnly; não mova tokens de autenticação para storage do navegador.
- Mantenha requisições Axios com credenciais via `withCredentials`.
- Mantenha transferências longas fora do caminho HTTP request/response; use trabalhadores BullMQ.
- Emita progresso de transferência via Socket.io quando o painel depender disso.
- Valide entradas sensíveis com Zod e middleware de validação de rotas.
- Criptografe credenciais de terceiros antes de persistir.
- Não registre segredos, tokens, cookies, senhas ou dados reais de usuários.
- Preserve a linguagem visual escura do React/Tailwind e as pastas de componentes existentes.
- Mantenha respostas concisas e precisas; use o modo profissional curto inspirado no Caveman documentado em `docs/ai/agent-tooling.md`.
- Se `rtk` estiver disponível, prefira-o para saídas shell ruidosas. Use comandos normais quando a saída completa for necessária ou quando `rtk` estiver ausente.

## Validação

Back-end:

```bash
cd backend
npm run dev
```

Front-end:

```bash
cd frontend
npm run lint
npm run build
```

Se uma mudança tocar integração, confira porta do back-end, `FRONTEND_URL`, `VITE_API_URL` do front-end, CORS, cookies, MongoDB e Redis em conjunto.

## Referências

- `references/architecture.md`: arquitetura e convenções compactas.
- `references/mcp-workflow.md`: seleção de MCPs e notas de segurança.
