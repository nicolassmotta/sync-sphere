# Ferramentas de Agentes

Este projeto usa referências locais para melhorar sessões com Codex e agentes do curso sem transformar ferramentas de agente em dependências do produto.

## Repositórios Adicionados

Clones locais em `agent-repos/`:

- `caveman`: `https://github.com/juliusbrussee/caveman`
- `rtk`: `https://github.com/rtk-ai/rtk`

`agent-repos/` deve permanecer no `.gitignore`. Registre aqui as decisões que precisam viajar com o projeto.

## Política Obrigatória

- Carregar `AGENTS.md`, `docs/ai/project-context.md`, este arquivo e `docs/ai/skill-policy.md` no começo de tarefas relevantes.
- Usar comunicação curta, objetiva e sem enchimento, inspirada no `caveman`, mas mantendo Português natural e precisão técnica.
- Usar `rtk` sempre que estiver instalado e a saída puder ser grande.
- Recorrer a comandos normais quando `rtk` não existir, quando a saída filtrada esconder detalhe necessário ou quando o usuário pedir saída bruta.
- Nunca compactar código, comandos, caminhos, variáveis, datas, versões, mensagens de erro ou alertas de segurança a ponto de perder significado.
- Usar Português como padrão em docs, UI, logs, comentários e mensagens de commit.
- Usar Conventional Commits com tipo em inglês e descrição em Português, por exemplo `feat: adicionar guia local`.

## Caveman no SyncSphere

Modo adotado: profissional curto, equivalente ao modo leve.

Use:

- frases diretas;
- sem cumprimentos longos ou cautela vazia;
- bullets curtos quando ajudarem;
- detalhes técnicos intactos.

Nao use:

- caricatura que atrapalhe Português;
- abreviações obscuras em docs de usuário;
- modo telegráfico em avisos de risco, ações destrutivas, PRs, commits ou documentação pública que precise ser clara.

## RTK no SyncSphere

Quando `rtk` estiver no PATH, prefira:

```bash
rtk git status
rtk git diff
rtk grep "pattern" .
rtk read caminho/do/arquivo
rtk test npm test
rtk err npm run lint
rtk err npm run build
```

Comandos úteis após instalar:

```bash
rtk --version
rtk gain
rtk init -g --codex
```

Notas:

- O hook do RTK reescreve comandos shell para versões compactadas em agentes compatíveis.
- No Codex, a integração documentada pelo RTK adiciona instruções em `AGENTS.md`/`RTK.md`; mantenha este arquivo como fonte de verdade do projeto.
- Se um comando falhar e o resumo for insuficiente, rode o comando normal ou use o modo de passagem direta do RTK quando disponível.

## Instalação Local Sugerida

Atualizar clones:

```bash
git clone https://github.com/juliusbrussee/caveman agent-repos/caveman
git clone https://github.com/rtk-ai/rtk agent-repos/rtk
```

Instalar RTK, se desejado:

```bash
cargo install --git https://github.com/rtk-ai/rtk
rtk init -g --codex
```

Instalar Caveman no Codex, se o ambiente suportar plugins locais:

```text
Abrir Codex no repo do caveman -> /plugins -> instalar Caveman.
```

Mesmo sem hooks/plugins, `AGENTS.md` torna o comportamento padrão para agentes que leem instruções do projeto.
