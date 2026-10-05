# Segurança

[English security guide](docs/en/security.md)

O SyncSphere guarda credenciais de plataformas em arquivos cifrados. Os arquivos em `backend/data/`, o `.env` e a chave de criptografia pertencem à instalação local e devem ser protegidos junto com seus backups.

O aplicativo não possui autenticação própria. Execute-o em uma máquina e rede confiáveis. Exposição na internet exige proteção de acesso externa e configuração adequada de origem, CORS e transporte.

O guia de [configuração](docs/configuration.md) descreve os diretórios e valores relevantes; a [arquitetura](docs/architecture.md) explica a persistência. CORS e criptografia dos arquivos não substituem uma camada de controle de acesso ao servidor.

## Relatar uma vulnerabilidade

Não publique cookies, tokens, chaves ou detalhes de exploração em uma issue pública. Se o GitHub oferecer a opção **Report a vulnerability** na aba Security, use esse canal privado. Caso ela não esteja disponível, abra uma issue pedindo um canal privado ao mantenedor, sem incluir os detalhes da falha.

No relato privado, informe o commit ou versão afetada, os passos de reprodução, o impacto e uma correção sugerida, se houver. Use dados fictícios e contas de teste.

## Correções e atualização

As correções são aplicadas à `main` e incluídas na próxima versão. A versão 1.1.0 está em preparação; consulte o changelog antes de atualizar uma instalação antiga.

Para verificar dependências da sua instalação:

```bash
npm audit --omit=dev --prefix backend
npm audit --omit=dev --prefix frontend
```

Para atualizar, faça backup do diretório de dados e da chave de criptografia, instale as dependências dos lockfiles e gere novamente o frontend. Não troque `ENCRYPTION_KEY` ao reutilizar arquivos cifrados existentes.

Use uma versão LTS suportada do Node.js, como 22 ou 24, conforme o [calendário oficial](https://nodejs.org/en/about/previous-releases). A criptografia protege os JSONs em repouso; a chave local e os arquivos do `.env` também precisam de permissões e backups protegidos.
