# Guia de Agentes do SyncSphere

Use este arquivo como briefing inicial para qualquer agente/assistente trabalhando neste projeto.

## Identidade do Produto

SyncSphere é uma aplicação fullstack para migrar playlists entre plataformas de música (hoje Spotify e YouTube Music, com arquitetura de provedores para adicionar outras). É open-source self-hosted single-user: a pessoa clona, configura credenciais e usa localmente. O produto combina conexões com serviços de música, fila local para transferências e painel React para acompanhar progresso. Não há contas, login nem banco de dados.

## Tecnologias e Estrutura

- `backend/`: API Node.js + Express em ESM, arquitetura MVC, Socket.io. Persistência local em arquivos JSON cifrados (`backend/data/`) e fila de transferências local persistida em `data/queue.json`. Sem MongoDB, sem Redis, sem login.
- `frontend/`: React 18 + Vite, React Router, Zustand, Axios com `withCredentials`, TailwindCSS, Framer Motion, Lucide.
- `docs/ai/`: contexto operacional para agentes, MCPs e prompts repetíveis.
- `.agents/skills/sync-sphere/`: skill local do projeto para reutilizar este contexto.
- `agent-repos/`: clones locais opcionais de ferramentas para agentes. Atualmente usado para `caveman` e `rtk`; mantenha ignorado pelo Git e registre decisões em `docs/ai/agent-tooling.md`.

## Modo Obrigatório para Agentes

Todo agente trabalhando neste projeto deve carregar primeiro a skill/contexto `sync-sphere` e seguir `docs/ai/skill-policy.md`.

Use sempre as práticas de economia de contexto inspiradas por:

- `caveman` (`agent-repos/caveman`): responda de forma objetiva, sem enchimento, preservando precisão técnica. Use estilo profissional curto, não caricatural, principalmente em Português.
- `rtk` (`agent-repos/rtk`): quando o binário `rtk` estiver disponível, prefira `rtk` para comandos com saída grande (`rtk git status`, `rtk git diff`, `rtk test npm test`, `rtk grep`, `rtk read`). Se `rtk` não estiver instalado ou esconder detalhe necessário, use o comando normal e explique o motivo.

Codex e agentes do curso devem tratar estas regras como padrão de sessão. Código, mensagens de commit, PRs, docs de usuário e avisos de segurança continuam em linguagem normal e clara.

## Idioma e Commits

- Português é o idioma padrão do projeto para documentação, UI, mensagens de erro, logs, comentários e commits.
- Preserve em inglês apenas contratos técnicos ou nomes oficiais: variáveis de ambiente, rotas, pacotes, APIs externas, enums já persistidos e termos exigidos por bibliotecas.
- Use Conventional Commits com tipo em inglês e descrição em Português, sem ponto final.
- Exemplos: `feat: adicionar seleção múltipla de playlists`, `fix: corrigir validação do cookie do YouTube Music`, `docs: atualizar guia local`.

## Como Rodar

Fluxo local principal:

```bash
npm run setup
cp backend/.env.example backend/.env
# preencha backend/.env
npm start
```

Abra `http://localhost:8000`.

Back-end em desenvolvimento:

```bash
cd backend
npm install
npm run dev
```

Front-end em desenvolvimento:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Serviços esperados:

- Aplicação local empacotada: `http://localhost:8000`
- Front-end Vite em desenvolvimento: `http://localhost:5173`
- Back-end: `http://localhost:8000` por padrão do `.env.example`
- API base esperada no Vite: `VITE_API_URL=http://localhost:8000/api/v1`; no app servido pelo back-end, `frontend/src/services/api.js` usa `/api/v1`.
- Dados locais: arquivos cifrados em `backend/data/` (sem banco de dados externo).
- Spotify OAuth: `SPOTIFY_CLIENT_ID` e `SPOTIFY_REDIRECT_URI=http://127.0.0.1:8000/api/v1/integrations/spotify/callback` (Authorization Code + PKCE, sem `SPOTIFY_CLIENT_SECRET`)
- YouTube Music: cookie colado em Integrações ou `YTMUSIC_COOKIE`
- Plataformas: adaptadores em `backend/src/providers/<id>/`, registrados em `backend/src/providers/registry.js`.

## Convenções de Implementação

- Preserve ESM no backend (`import/export`).
- Mantenha controllers finos; regras de negócio devem ficar em services/trabalhadores quando crescerem.
- Valide payloads com Zod e middleware de validação.
- Propague erros para `next(error)` e use `AppError` para erros operacionais.
- Não reintroduza MongoDB, Redis, contas ou login: o projeto é local-first single-user e deve subir sem infraestrutura externa.
- Persistência é local, em arquivos JSON cifrados (`backend/data/`, via `src/storage/`). Tokens/cookies de terceiros devem ser criptografados antes de persistir e `backend/data/` nunca deve ser versionado.
- Integrações externas vivem em `/api/v1/integrations`; use essas rotas para status, Spotify OAuth e cookie do YouTube Music.
- No front-end, centralize HTTP em `frontend/src/services/api.js` e estado de sessão em `useAuthStore`.
- Use componentes existentes em `components/layout`, `components/setup`, `components/dashboard` e `components/ui` antes de criar novos padrões.
- Mantenha a UI dark premium com Tailwind e cores `spotify`, `youtube`, `darkBackground`, `surfaceCard`.

## Checklist Antes de Entregar Mudanças

- Back-end: rode pelo menos `npm run dev` quando a mudança tocar bootstrap, rotas, storage local ou fila.
- Front-end: rode `npm run lint` e `npm run build` quando a mudança tocar UI/React.
- Para mudanças de integração, valide cookies com `withCredentials`, CORS e porta configurada.
- Atualize `docs/ai/` quando adicionar arquitetura, fluxos, MCPs, decisões ou prompts que devem ser reaproveitados.

## Contexto para Agentes

Leia nesta ordem quando precisar de mais contexto:

1. `docs/ai/README.md`
2. `docs/ai/project-context.md`
3. `docs/ai/agent-tooling.md`
4. `docs/ai/skill-policy.md`
5. `docs/ai/mcp-catalog.md`
6. `docs/ai/prompt-recipes.md`
