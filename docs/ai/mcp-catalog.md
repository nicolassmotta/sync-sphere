# Catálogo de ferramentas e MCPs

Este catálogo é opcional e descreve capacidades úteis para manutenção do SyncSphere. Ele não declara que servidores estão instalados em todas as máquinas. A configuração pertence ao ambiente de quem contribui, não ao aplicativo.

## Escolher uma capacidade

| Capacidade | Uso no projeto | Escopo |
|---|---|---|
| Filesystem | Código, documentos e exemplos locais | Raiz do repositório e arquivos necessários à tarefa. |
| Git | Status, diff, histórico e commits | Repositório atual; conferir branch e alterações existentes. |
| Context7 | Contratos atuais de bibliotecas e SDKs | Consultar documentação oficial antes de adotar uma API nova. |
| GitHub | PRs, issues e CI | Remoto `nicolassmotta/sync-sphere`, quando autorizado pela tarefa. |
| Navegador | UI, responsividade, uploads e capturas | Preferir `agent-browser` quando disponível e usar sessão própria. |
| Figma | Design de referência fornecido | Somente o arquivo conectado e relevante ao pedido. |

CLI e ferramentas nativas podem atender ao mesmo fluxo sem MCP. O projeto usa armazenamento local, então não precisa de servidor de banco de dados ou Redis.

## Configuração opcional

[mcp.example.json](mcp.example.json) é um modelo conceitual com placeholders. Substitua comandos e caminhos de acordo com o cliente e os servidores efetivamente instalados. Não é uma configuração pronta para copiar e executar sem ajustes.

Conectores externos, como Rube/Composio, são opcionais e não fazem parte da execução do SyncSphere. Configure-os apenas quando uma tarefa exigir essa capacidade e houver autorização para seu uso.

## Segurança e manutenção

- Mantenha acesso a arquivos limitado ao necessário.
- Nunca inclua `.env`, credenciais reais ou conteúdo de `backend/data/` em configurações compartilhadas ou exemplos.
- Use dados demonstrativos para navegador e capturas públicas.
- Confirmar a existência de uma ferramenta não autoriza envio de mensagens, publicação ou alterações em serviços externos.
- Registre novos usos recorrentes e seus limites neste catálogo, mantendo as configurações específicas da máquina fora do Git.

As referências de Caveman/RTK ficam em `agent-repos/`, ignoradas pelo Git. Veja [agent-tooling.md](agent-tooling.md) e [skill-policy.md](skill-policy.md).
