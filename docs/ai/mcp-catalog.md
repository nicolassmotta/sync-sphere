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

- raiz local do repositório clonado, por exemplo `C:\Users\Nicolas\sync-sphere` no Windows ou `~/sync-sphere` em Linux/macOS.

Por que usar: permite que o agente leia código, docs e implemente mudanças sem depender de colagens manuais.

### git

Uso: diffs, histórico, status, commits e revisões.

Observação: confirme branch, remoto e working tree antes de commits, pushes ou PRs.

> Observação: o projeto é local-first e não usa banco de dados nem Redis. Os dados ficam em arquivos JSON cifrados em `backend/data/`, então não há MCP de MongoDB ou Redis. Para inspecionar dados locais, use o MCP `filesystem` (com cuidado, pois `data/` contém credenciais cifradas).

### browser/playwright

Uso: validar UI real do Vite, rotas, painel, responsividade e capturas de tela.

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
      "allowedRoots": ["<caminho-absoluto-para-sync-sphere>"]
    },
    "syncsphere-browser": {
      "purpose": "Rodar checagens locais de UI contra Vite e back-end"
    }
  }
}
```

## Política de Segredos

- Nunca colocar `.env`, tokens Spotify, cookies do YouTube Music ou o conteúdo de `backend/data/` em docs.
- Usar `.env.example` para formato e nomes de variáveis.
- Em prompts para agentes, substituir valores sensíveis por placeholders.
- `backend/data/` contém credenciais cifradas e nunca deve ser versionado ou colado em docs.

## Quando Adicionar Um MCP Novo

Adicione ao catálogo quando:

- virar parte recorrente do fluxo de trabalho;
- reduzir colagem manual de contexto;
- der ao agente acesso verificável a uma fonte de verdade;
- tiver limites claros de permissão e dados.
