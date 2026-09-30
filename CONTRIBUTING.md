# Como contribuir

O SyncSphere é um aplicativo local para uma pessoa, com dados cifrados em arquivos e fila no processo. Mudanças devem preservar esse modelo e o contrato dos provedores de música.

## Preparar o ambiente

Use Node.js 20 ou superior. Na raiz do repositório:

```bash
npm ci --prefix backend
npm ci --prefix frontend
cp backend/.env.example backend/.env
npm run build
npm start
```

No PowerShell, substitua o comando de cópia por `Copy-Item backend/.env.example backend/.env`. Configure apenas os serviços que pretende testar. O painel fica em `http://localhost:8000`.

Para trabalhar na interface com atualização automática, rode `npm run dev:backend` e `npm run dev:frontend` em terminais separados. Confira `FRONTEND_URL` e `VITE_API_URL` conforme o README.

## Implementar uma mudança

1. Crie uma branch a partir da `main` atualizada.
2. Descreva o problema ou comportamento esperado em uma issue ou no PR.
3. Preserve ESM no backend e os componentes compartilhados da interface.
4. Valide entradas HTTP com Zod e mantenha controllers pequenos.
5. Acrescente testes para regras de negócio e falhas relevantes.
6. Atualize o README ou o changelog quando o comportamento visível mudar.

Use identificadores de código em inglês. UI, mensagens, documentação e commits usam português. Commits seguem Conventional Commits, por exemplo `fix: corrigir retomada da playlist`.

Formate apenas os arquivos alterados. Examine o diff antes de abrir o PR. Credenciais de teste devem ser fictícias; `.env`, dados locais e logs pessoais ficam fora do Git.

## Adicionar um provedor

O contrato está em `backend/src/providers/registry.js`. Um adaptador informa autenticação, capacidades, leitura de playlists, busca e criação do destino. Registre-o no backend e em `frontend/src/constants/providers.js`.

Na inserção, `ids` são as ocorrências pendentes e `expectedIds` contém todas as ocorrências resolvidas da transferência. Leia o destino e reconcilie quantidades antes de escrever. Se a leitura falhar, propague o erro. Preserve repetições intencionais e teste uma segunda execução após escrita parcial.

Informe claramente no README se a integração é oficial ou não oficial, quais credenciais usa e quais limites tem. Um teste com respostas simuladas não comprova escrita real na conta do serviço.

## Verificar antes do PR

```bash
npm test
npm run lint
npm run build
npm audit --omit=dev --prefix backend
npm audit --omit=dev --prefix frontend
git diff --check
```

Os testes usam diretórios temporários separados e respostas simuladas das plataformas. Para validar a aplicação empacotada, rode `npm start` e confira `/api/health`, `/api/ready` e o painel.

No PR, explique o problema, o resultado da mudança e os comandos que executou. Registre limites de validação, especialmente quando uma integração externa não foi testada com credenciais reais.

## Relatar um problema

Inclua versão ou commit, sistema operacional, versão do Node.js, plataformas envolvidas, passos para reproduzir e resultado esperado. Remova tokens, cookies, URLs privadas e dados pessoais dos exemplos.

Para problemas de segurança, siga [SECURITY.md](SECURITY.md). O plano das fases está em [docs/roadmap.md](docs/roadmap.md).
