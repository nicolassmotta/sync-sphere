# Pacotes portáteis e iniciador local

[Índice da documentação](README.md)

O iniciador abre o aplicativo no navegador e mantém o servidor local em uma janela de terminal. Os pacotes portáteis incluem o runtime Node.js e as dependências de produção. Não há conta do SyncSphere nem instalador com acesso administrativo.

Cada versão publicada traz os pacotes na página de [Releases](https://github.com/nicolassmotta/sync-sphere/releases). Gerar um pacote local não publica uma tag nem uma Release.

## Usar um pacote

1. Na Release, baixe o arquivo da plataforma e arquitetura do computador: `win-x64` para a maioria dos Windows, `darwin-arm64` para Mac com Apple Silicon (M1 ou mais novo), `darwin-x64` para Mac com Intel e `linux-x64` para a maioria dos Linux.
2. Se quiser conferir o download, compare a soma SHA-256 do arquivo com `SHA256SUMS.txt`.
3. Extraia a pasta inteira. Não execute dentro do arquivo compactado.
4. Abra `Iniciar.cmd` no Windows, `Iniciar.command` no macOS ou `Iniciar.sh` no Linux.
5. O navegador abre o painel. Mantenha a janela do iniciador aberta durante as migrações.

O Windows recebe ZIP. Linux e macOS recebem TAR.GZ. Os pacotes não são instaladores assinados, e o sistema pode pedir confirmação na primeira abertura:

- Windows: em **O Windows protegeu o computador**, clique em **Mais informações** e em **Executar assim mesmo**.
- macOS: se o sistema disser que não pode verificar o desenvolvedor, abra **Ajustes do Sistema > Privacidade e Segurança** e clique em **Abrir Mesmo Assim**. Em versões anteriores ao macOS 15, clique com o botão direito em `Iniciar.command` e escolha **Abrir**.

Faça isso só com pacotes baixados da página oficial de Releases. Não desative proteções do sistema para abrir uma origem que você não verificou.

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

As plataformas previstas são `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `win-x64` e `win-arm64`. Gerar o pacote não comprova a execução em cada sistema operacional; para isso, use a conferência abaixo no sistema correspondente.

Os arquivos são gerados em `artifacts/`, ignorado pelo Git, com a versão do `package.json` no nome, manifesto e soma SHA-256. A cópia usa caminhos explícitos e exclui `.env`, dados, logs, credenciais e arquivos desta máquina. Somente dependências de produção entram no backend empacotado. O painel é compilado com API relativa, sem herdar uma URL pessoal de desenvolvimento. A licença do Node.js acompanha o runtime.

## Conferir um pacote

No sistema e na arquitetura do pacote, com Node.js disponível:

```bash
node scripts/verify-package.mjs artifacts/syncsphere-1.1.0-linux-x64.tar.gz
```

O script confere a soma SHA-256, a plataforma do manifesto e a ausência de `.env` e dados locais. Depois extrai o pacote em uma pasta temporária, abre pelo iniciador com `--no-browser` na porta 18765 (ou `--port`), espera o painel responder e encerra o aplicativo. Nada fica na máquina.

## Publicar com o workflow Release

O workflow [Release](../.github/workflows/release.yml) roda quando uma tag `vX.Y.Z` chega ao GitHub:

1. Confere se a tag bate com a versão dos `package.json` e lockfiles, se o CHANGELOG tem a data da versão e se existe `docs/releases/vX.Y.Z.md`.
2. Roda o CI completo: testes, lint, build e smoke test.
3. Gera os seis pacotes e `SHA256SUMS.txt`.
4. Abre cada pacote com `verify-package.mjs` em um runner do próprio sistema: Linux, macOS e Windows, em x64 e ARM.
5. Só com tudo aprovado, cria a GitHub Release com as notas de `docs/releases/vX.Y.Z.md` e anexa os pacotes.

Em pull requests que mexem no empacotamento, e na execução manual pela aba Actions, o workflow faz as etapas de geração e conferência e para antes de publicar. Os pacotes ficam disponíveis por sete dias como artefato da execução.

## Atualizar preservando os dados

1. Crie um [backup protegido](backups.md) e encerre o aplicativo.
2. Extraia a nova versão em outra pasta.
3. Mantenha a pasta antiga até conferir a atualização.
4. Restaure o backup na nova instalação. Se usava configuração por `.env`, mantenha-a separadamente.
5. Abra a nova instalação e confira Histórico, conexões e exportações.

Não substitua a pasta inteira de uma instalação em execução. O servidor usa `127.0.0.1` por padrão. `HOST` permite uma configuração avançada diferente, mas as rotas de backup e diagnóstico continuam restritas a conexões locais.
