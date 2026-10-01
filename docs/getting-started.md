# Primeiros passos

[Índice da documentação](README.md)

## Antes de instalar

Tenha Git, Node.js e npm instalados. Recomendamos **Node.js 22 ou 24 LTS**. O requisito técnico atual é Node.js 20+, mas essa linha já está fora do suporte oficial. Consulte o [calendário do Node.js](https://nodejs.org/en/about/previous-releases).

```bash
node --version
npm --version
git --version
```

A conversão entre arquivos funciona sem credenciais de música. Para serviços externos, configure apenas os provedores que pretende usar.

## Instalar

No terminal:

```bash
git clone https://github.com/nicolassmotta/sync-sphere.git
cd sync-sphere
npm run setup
```

O script instala backend e frontend e gera `frontend/dist`.

Em Linux ou macOS:

```bash
cp backend/.env.example backend/.env
```

No Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

Para o teste com Arquivo, mantenha as credenciais opcionais vazias. A configuração padrão usa porta `8000`, fila habilitada e chave de criptografia gerada automaticamente.

## Iniciar

Na raiz do projeto:

```bash
npm start
```

Abra [http://localhost:8000](http://localhost:8000). O mesmo servidor entrega a interface, a API e os eventos de progresso.

Para conferir o servidor:

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/ready
```

As respostas esperadas têm `status: "OK"` e `status: "ready"`, respectivamente. No PowerShell, use `curl.exe` se `curl` estiver associado a outro comando.

## Primeira transferência sem contas

1. No painel, escolha **Arquivo** como origem e destino.
2. Importe [docs/examples/playlist.csv](examples/playlist.csv), que já está no repositório clonado.
3. Selecione a playlist importada e revise a transferência.
4. Inicie a migração e acompanhe o progresso.
5. No Histórico, abra os detalhes e baixe CSV, JSON, M3U ou TXT.

O exemplo tem três faixas fictícias. O resultado contém uma lista de metadados, não arquivos de áudio. Você pode abrir o CSV ou JSON gerado para conferir os dados.

## Conectar serviços de música

Abra **Integrações** e siga o [guia da plataforma](integrations.md). Apps OAuth precisam ser configurados no `.env`; cookies e tokens de conta podem ser colados no painel quando o provedor oferece esse método.

Alterações no `.env` exigem reiniciar o backend. Credenciais salvas pelo painel valem na hora e têm prioridade sobre os valores equivalentes do `.env`.

## Parar e iniciar novamente

Use `Ctrl+C` no terminal do servidor. Para voltar, rode `npm start` na raiz. A fila persistida permite recuperar trabalhos inacabados; mantenha o diretório de dados e sua chave de criptografia.

## Atualizar uma instalação

1. Pare o servidor.
2. Faça backup do `.env`, do diretório de dados e da chave usada para cifrá-lo.
3. Atualize o código para a versão escolhida.
4. Rode os comandos abaixo na raiz:

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm run build
npm start
```

Confira saúde, integrações e histórico antes de começar uma nova migração. Preserve a chave de criptografia ao reutilizar dados existentes. As [notas da versão](releases/v1.1.0.md) descrevem compatibilidade e limites.

Para desenvolvimento com Vite, siga [CONTRIBUTING.md](../CONTRIBUTING.md). Para problemas de instalação, consulte [Solução de problemas](troubleshooting.md).


## Iniciador e primeira experiência

Depois de `npm run setup`, use `npm run open`. O iniciador prepara a configuração somente se estiver ausente, abre o painel e informa como manter a janela ativa. Uma instalação que já esteja usando a mesma porta é identificada antes de abrir outra pasta por engano.

No painel, **Experimentar sem contas** importa dados fictícios e prepara Arquivo para Arquivo. Não é necessário localizar o CSV no repositório. Veja [Sua primeira migração](primeira-migracao.md), [pacotes portáteis](distribution.md) e [backup protegido](backups.md).

O servidor escuta em `127.0.0.1` por padrão. `HOST` é uma configuração avançada para outro endereço. Backup e diagnóstico continuam restritos a conexões locais.
