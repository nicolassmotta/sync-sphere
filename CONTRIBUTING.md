# Como contribuir

[English contribution guide](docs/en/contributing.md)

O SyncSphere é um aplicativo local para uma pessoa, com dados cifrados em arquivos e fila no processo. Mudanças devem preservar esse modelo e o contrato dos provedores de música.

## Preparar o ambiente

Recomendamos Node.js 22 ou 24 LTS, conforme o [calendário oficial](https://nodejs.org/en/about/previous-releases). O requisito técnico atual é 20+. Na raiz do repositório:

```bash
npm ci --prefix backend
npm ci --prefix frontend
cp backend/.env.example backend/.env
npm run build
npm start
```

No PowerShell, substitua o comando de cópia por `Copy-Item backend/.env.example backend/.env`. Configure apenas os serviços que pretende testar. O painel fica em `http://localhost:8000`.

Para trabalhar na interface com atualização automática, rode `npm run dev:backend` e `npm run dev:frontend` em terminais separados. Confira `FRONTEND_URL` e `VITE_API_URL` no [guia de configuração](docs/configuration.md). O [índice da documentação](docs/README.md) organiza os demais guias.

## Implementar uma mudança

1. Crie uma branch a partir da `main` atualizada.
2. Descreva o problema ou comportamento esperado em uma issue ou no PR.
3. Preserve ESM no backend e os componentes compartilhados da interface.
4. Valide entradas HTTP com Zod e mantenha controllers pequenos.
5. Acrescente testes para regras de negócio e falhas relevantes.
6. Atualize o guia público relevante e o changelog quando o comportamento visível mudar. Preserve o índice em `docs/README.md`.

Use identificadores de código em inglês. UI e mensagens próprias oferecem português e inglês. Documentação pública inicial tem versões nos dois idiomas; manutenção e commits usam português. Commits seguem Conventional Commits, por exemplo `fix: corrigir retomada da playlist`.

Formate apenas os arquivos alterados. Examine o diff antes de abrir o PR. Credenciais de teste devem ser fictícias; `.env`, dados locais e logs pessoais ficam fora do Git.

## Adicionar um provedor

O contrato está em `backend/src/providers/registry.js`. Um adaptador informa autenticação, capacidades, leitura de playlists, busca e criação do destino. Registre-o no backend e em `frontend/src/constants/providers.js`.

Na inserção, `ids` são as ocorrências pendentes e `expectedIds` contém todas as ocorrências resolvidas da transferência. Leia o destino e reconcilie quantidades antes de escrever. Se a leitura falhar, propague o erro. Preserve repetições intencionais e teste uma segunda execução após escrita parcial.

Informe claramente no README se a integração é oficial ou não oficial, quais credenciais usa e quais limites tem. Um teste com respostas simuladas não comprova escrita real na conta do serviço.

## Verificar antes do PR

```bash
npm test
npm run test:i18n --prefix frontend
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

## Contribuir com documentação e exemplos

As capturas públicas devem usar dados demonstrativos, com origem descrita em `docs/media-kit.md`. Os exemplos de playlist precisam ser aceitos pelo importador e não devem conter credenciais ou links privados. Verifique links locais, referências de configuração e comandos antes de abrir o PR.

Preserve a diferença entre uma capacidade implementada, uma resposta externa simulada em teste e uma operação confirmada em conta real. Mantenha a versão em preparação identificada até sua publicação. O material para apresentação está em [docs/media-kit.md](docs/media-kit.md).


## Primeiras contribuições

Você pode começar com uma tarefa pequena e verificável:

- Conferir o fluxo por teclado ou em tela pequena e relatar a dificuldade encontrada.
- Executar um pacote portátil no seu sistema, usando dados demonstrativos, e registrar versão e resultado.
- Melhorar uma instrução do assistente de conexão ou um exemplo de arquivo.
- Rodar o [roteiro com pessoas que estão começando](docs/usability-testing.md) e registrar observações sem dados privados.
- Conferir relatórios e documentação contra uma transferência Arquivo para Arquivo.

O [guia de distribuição](docs/distribution.md) explica como gerar um pacote local. Não anuncie suporte validado a um sistema operacional somente porque o arquivo foi gerado. Para bugs, Ajuda e segurança permite revisar e baixar um diagnóstico sem credenciais; anexá-lo à issue é opcional.

Para alterar textos, mantenha os catálogos PT/EN alinhados e preserve dados fornecidos pela pessoa. Confira o [guia de idiomas](docs/localization.md). Use frases curtas, com ação e próxima etapa claras.
