# Frontend do SyncSphere

Painel React 18 com Vite 6, React Router, Zustand, Axios, TailwindCSS, Framer Motion e Lucide. A interface reúne configuração, escolha dos provedores, playlists, progresso e revisão manual no Histórico.

## Executar em desenvolvimento

Na raiz, instale dependências:

```bash
npm ci --prefix backend
npm ci --prefix frontend
```

Inicie o backend com `npm run dev:backend`. Em outro terminal, prepare o ambiente do frontend:

```bash
cp frontend/.env.example frontend/.env
npm run dev:frontend
```

No PowerShell, use `Copy-Item frontend/.env.example frontend/.env`. O Vite usa `http://localhost:5173` por padrão. Configure a origem exata em `FRONTEND_URL`/`FRONTEND_URLS` no backend quando necessário.

Se a API usar outra porta, defina em `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:8000/api/v1
```

No uso empacotado, mantenha essa variável vazia para usar a mesma origem do painel. O [guia de configuração](../docs/configuration.md) detalha portas e CORS.

## Verificar e compilar

Neste diretório:

```bash
npm run lint
npm run build
```

O build fica em `frontend/dist`. Na raiz, `npm start` sobe o backend que serve esse build. `npm run setup` instala os dois subprojetos e gera a interface.

## Convenções

- Centralize HTTP em `src/services/api.js` e mantenha `withCredentials`.
- Reaproveite primitivas em `components/ui` e a estrutura em `components/layout`.
- Use hooks para efeitos e fluxos reutilizáveis.
- O usuário da aplicação é local e implícito; não há login próprio.
- Textos da interface ficam em português; identificadores técnicos ficam em inglês.
- Confira responsividade, rótulos de campos, teclado e estados de erro ao alterar uma tela.

## Guias

- [Como usar](../docs/usage.md): fluxo visível e revisão manual.
- [Contribuição](../CONTRIBUTING.md): comandos e processo de PR.
- [Arquitetura](../docs/architecture.md): integração com o backend.
- [Componentes reutilizáveis](../docs/ai/ui-components.md): propriedades e exemplos.
- [Solução de problemas](../docs/troubleshooting.md): conexão, CORS e progresso.
