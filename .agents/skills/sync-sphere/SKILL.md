---
name: sync-sphere
description: Implementar, revisar, depurar e documentar o SyncSphere, app React/Vite e Node/Express para migrar playlists entre provedores de música e arquivos, com armazenamento cifrado, fila persistida, Socket.io e revisão manual. Use em tarefas deste repositório.
---

# SyncSphere

## Visão Geral

Use esta skill para trabalhar no repositório SyncSphere com o contexto do projeto já carregado. Prefira mudanças concisas e nativas do repositório, preserve as decisões de autenticação, fila e segurança, e atualize os documentos de contexto de IA quando surgir conhecimento recorrente.

## Início Rápido

1. Leia `AGENTS.md` na raiz do repositório.
2. Leia `docs/ai/project-context.md` para arquitetura, portas, convenções e mapa de arquivos.
3. Leia `docs/ai/agent-tooling.md` e `docs/ai/skill-policy.md` para comportamento de agentes, uso de Caveman/RTK e escopo de skills.
4. Leia `docs/ai/mcp-catalog.md` quando a tarefa precisar de MCPs ou ferramentas externas.
5. Leia `docs/ai/prompt-recipes.md` quando a tarefa for um fluxo recorrente.
6. Use os scripts do subprojeto relevante antes de inventar comandos.
7. Para documentação pública, use `docs/README.md` como índice e preserve os guias de instalação, integração, uso e divulgação. Capturas devem usar dados demonstrativos e informar respostas externas simuladas quando aplicável.

## Regras do Projeto

- Mantenha o back-end em ESM.
- Modelo local-first: não reintroduza MongoDB, Redis, contas ou login. O app deve subir sem infraestrutura externa.
- Persistência é local em arquivos JSON cifrados (`backend/data/`, via `src/storage/`); nunca versione `backend/data/`.
- Mantenha requisições Axios com credenciais via `withCredentials`.
- Mantenha transferências longas fora do caminho HTTP request/response; use a fila local + trabalhador.
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

Se uma mudança tocar integração, confira porta do back-end, `FRONTEND_URL`, `VITE_API_URL` do front-end, CORS e cookies de OAuth em conjunto.

## Referências

- `references/architecture.md`: arquitetura e convenções compactas.
- `references/mcp-workflow.md`: seleção de MCPs e notas de segurança.
