# Pacotes portáteis e iniciador local

[Índice da documentação](README.md)

O iniciador abre o aplicativo no navegador e mantém o servidor local em uma janela de terminal. Os pacotes portáteis incluem o runtime Node.js e as dependências de produção. Não há conta do SyncSphere nem instalador com acesso administrativo.

A versão 1.1.0 continua em preparação. Gerar um pacote local não publica uma tag ou GitHub Release. Pacotes de outras plataformas precisam de teste no sistema correspondente antes de serem anunciados como validados.

## Usar um pacote

1. Escolha o arquivo da plataforma e arquitetura do computador.
2. Confira a soma SHA-256 disponibilizada junto do pacote.
3. Extraia a pasta inteira. Não execute dentro do arquivo compactado.
4. Abra `Iniciar.cmd` no Windows, `Iniciar.command` no macOS ou `Iniciar.sh` no Linux.
5. O navegador abre o painel. Mantenha a janela do iniciador aberta durante as migrações.

O Windows recebe ZIP. Linux e macOS recebem TAR.GZ. Os pacotes não são instaladores assinados; avisos do sistema operacional e a necessidade de permitir a execução de scripts podem ocorrer. Não desative proteções do sistema para abrir uma origem que você não verificou.

Se o navegador não abrir automaticamente, use o endereço mostrado no terminal. No Linux, também é possível executar `./Iniciar.sh` em um terminal na pasta extraída.

## Instalação pelo código

```bash
npm run setup
npm run open
```

O iniciador copia `.env.example` apenas quando a configuração ainda não existe. Nunca sobrescreve um `.env` existente. Uma demonstração com Arquivo funciona sem preencher credenciais.

Para validação automatizada, sem abrir uma janela de navegador:

```bash
npm run open -- --no-browser
```

## Gerar pacotes

Na raiz, com Node.js, npm, `tar`, `unzip` e `zip` disponíveis:

```bash
npm run package -- --target linux-x64
npm run package -- --target win-x64
npm run package -- --target darwin-arm64
```

Ou gere todas as plataformas previstas:

```bash
npm run package -- --all
```

O script usa Node.js 24.15.0 por padrão. `--node-version` permite selecionar outra versão existente no distribuidor oficial. O download vem de `nodejs.org` e a soma SHA-256 é conferida contra `SHASUMS256.txt` da mesma versão. Não há atualização silenciosa do runtime.

As plataformas previstas são `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `win-x64` e `win-arm64`. O empacotamento foi desenvolvido para execução em um ambiente com as ferramentas listadas acima; gerar o pacote não comprova a execução em cada sistema operacional.

Os arquivos são gerados em `artifacts/`, ignorado pelo Git, com versão marcada **preparação**, manifesto e soma SHA-256. A cópia usa caminhos explícitos e exclui `.env`, dados, logs, credenciais e arquivos desta máquina. Somente dependências de produção entram no backend empacotado. O painel é compilado com API relativa, sem herdar uma URL pessoal de desenvolvimento. A licença do Node.js acompanha o runtime.

## Atualizar preservando os dados

1. Crie um [backup protegido](backups.md) e encerre o aplicativo.
2. Extraia a nova versão em outra pasta.
3. Mantenha a pasta antiga até conferir a atualização.
4. Restaure o backup na nova instalação. Se usava configuração por `.env`, mantenha-a separadamente.
5. Abra a nova instalação e confira Histórico, conexões e exportações.

Não substitua a pasta inteira de uma instalação em execução. O servidor usa `127.0.0.1` por padrão. `HOST` permite uma configuração avançada diferente, mas as rotas de backup e diagnóstico continuam restritas a conexões locais.
