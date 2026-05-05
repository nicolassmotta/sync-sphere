# Catálogo de MCPs

Este catálogo descreve quais MCPs fazem sentido para o SyncSphere. Ele não guarda segredos nem substitui configurações locais do cliente de IA.

## MCPs Configurados no Codex Local

### rube

Status: opcional no ambiente local do agente.

- URL: `https://rube.app/mcp`
- Comando de verificação: `codex mcp list`
- Uso: habilita automações e ferramentas da Composio/Rube, especialmente skills importadas de `ComposioHQ/awesome-codex-skills`.
- Observação: uma sessão já aberta pode precisar ser reiniciada para enxergar ferramentas MCP recém-adicionadas.

## Ferramentas Locais para Agentes

As ferramentas abaixo ficam em `agent-repos/`, ignoradas pelo Git, para consulta e instalação local:

- `agent-repos/caveman`: referência para respostas mais curtas e objetivas.
- `agent-repos/rtk`: referência para compactar saídas de comandos via CLI/hook.

Veja `docs/ai/agent-tooling.md` para política de uso, instalação e alternativa quando a ferramenta não estiver disponível.

## MCPs Recomendados para o Projeto

### filesystem

Uso: leitura e edição controlada do projeto.

Escopo sugerido:

- `/home/nicolasmotta/sync-sphere`

Por que usar: permite que o agente leia código, docs e implemente mudanças sem depender de colagens manuais.

### git

Uso: diffs, histórico, status, commits e revisões.

Observação: confirme branch, remoto e working tree antes de commits, pushes ou PRs.

### mongodb

Uso: inspecionar coleções, documentos de desenvolvimento e schemas reais.

Escopo sugerido:

- database: `syncsphere`
- ambiente: desenvolvimento/local

Cuidados: nunca exponha dados reais de usuários, tokens ou cookies. Prefira dados seed/fakes para debug com agentes.

### redis

Uso: diagnosticar filas BullMQ, tarefas pendentes, falhas e trabalhadores.

Escopo sugerido:

- host local `127.0.0.1`
- porta `6379`

Cuidados: evite limpar filas ou keys sem confirmar. Operações destrutivas devem ser explícitas.

### browser/playwright

Uso: validar UI real do Vite, rotas, fluxo de login, painel, responsividade e capturas de tela.

Por que usar: mudanças no front-end devem ser verificadas visualmente, não só por build/lint.

### figma

Uso: quando houver design em Figma, componentes, design system ou pedido de implementar layout 1:1.

Cuidados: só usar quando o arquivo/design for mencionado ou conectado. Mantenha tokens de cor e componentes alinhados ao Tailwind.

### github

Uso: issues, PRs, revisões e automações, se o projeto for publicado em GitHub.

Cuidados: não assumir remoto existente. Confirmar antes de criar PR, issue ou fluxo de automação.

### rube/composio

Uso: automações externas via Composio/Rube e suporte a muitas skills do repo `ComposioHQ/awesome-codex-skills`.

Configuração no Codex:

```bash
codex mcp add rube --url https://rube.app/mcp
codex mcp login rube
```

Cuidados: confirme quais ferramentas/integrações serão usadas antes de executar ações em apps externos.

## Modelo de Configuração

Cada cliente de IA usa um formato próprio. Veja também `docs/ai/mcp.example.json` como template copiável com placeholders.

Use isto como checklist conceitual:

```json
{
  "mcpServers": {
    "syncsphere-filesystem": {
      "purpose": "Read/write this workspace only",
      "allowedRoots": ["/home/nicolasmotta/sync-sphere"]
    },
    "syncsphere-mongodb": {
      "purpose": "Inspect local development MongoDB",
      "database": "syncsphere"
    },
    "syncsphere-redis": {
      "purpose": "Inspect BullMQ queues in local Redis",
      "host": "127.0.0.1",
      "port": 6379
    },
    "syncsphere-browser": {
      "purpose": "Rodar checagens locais de UI contra Vite e back-end"
    }
  }
}
```

## Política de Segredos

- Nunca colocar `.env`, tokens Spotify, cookies do YouTube Music ou JWT em docs.
- Usar `.env.example` para formato e nomes de variáveis.
- Em prompts para agentes, substituir valores sensíveis por placeholders.
- MCPs de banco devem apontar para dev/local por padrão.

## Quando Adicionar Um MCP Novo

Adicione ao catálogo quando:

- virar parte recorrente do fluxo de trabalho;
- reduzir colagem manual de contexto;
- der ao agente acesso verificável a uma fonte de verdade;
- tiver limites claros de permissão e dados.
