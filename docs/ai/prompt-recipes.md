# Receitas de Prompt

Use estes prompts como ponto de partida para tarefas frequentes. Ajuste o trecho entre colchetes.

## Implementar Recurso de Ponta a Ponta

```text
Use o contexto do SyncSphere em AGENTS.md e docs/ai/project-context.md.
Siga docs/ai/agent-tooling.md e docs/ai/skill-policy.md.
Implemente [recurso] de ponta a ponta.
Preserve o modelo local-first (sem contas/Mongo/Redis), Axios com withCredentials, controllers finos, validação Zod e fila local quando a tarefa for longa.
Ao final, liste arquivos alterados e comandos de validação executados.
```

## Revisar Back-end

```text
Faça uma revisão de back-end no SyncSphere focada em bugs, segurança e regressões.
Leia backend/src, AGENTS.md, docs/ai/project-context.md, docs/ai/agent-tooling.md e docs/ai/skill-policy.md.
Priorize storage local cifrado, CORS, validação, criptografia, logs, fila local e tratamento de erros.
Traga achados com arquivo/linha e severidade.
```

## Revisar Front-end

```text
Revise o front-end do SyncSphere.
Leia frontend/src, AGENTS.md, docs/ai/project-context.md, docs/ai/agent-tooling.md e docs/ai/skill-policy.md.
Procure problemas de rotas, chamadas Axios, estados Zustand, responsividade e consistência visual com Tailwind.
Traga achados com arquivo/linha e severidade.
```

## Criar Tela ou Componente

```text
Crie [tela/componente] no front-end do SyncSphere.
Use os padrões atuais de React, Tailwind, Framer Motion e Lucide.
Mantenha dark UI premium, sem criar landing page explicativa se a tarefa for uma ferramenta/tela funcional.
Valide com lint/build quando possível.
```

## Diagnosticar Fila de Transferência

```text
Diagnostique o fluxo de transferência do SyncSphere.
Leia backend/src/services/queueService.js, backend/src/workers/transferWorker.js, models relacionados e docs/ai/project-context.md.
Verifique criação de tarefas, estados, retentativas, emissão Socket.io e persistência de falhas.
Não apague `backend/data/` (credenciais e histórico locais) sem pedir confirmação.
```

## Atualizar Contexto de IA

```text
Atualize a documentação de contexto de IA do SyncSphere.
Quando encontrar nova decisão arquitetural, comando, MCP, ferramenta de agente, prompt recorrente ou convenção, registre em docs/ai e ajuste AGENTS.md se for orientação de entrada.
Mantenha os textos curtos, práticos e sem segredos.
```
