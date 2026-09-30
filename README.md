<div align="center">
  <img src="frontend/public/favicon.svg" alt="Logo do SyncSphere" width="80" height="80" />
  <h1>SyncSphere</h1>
  <p><strong>Suas playlists entre plataformas, na sua máquina.</strong></p>
  <p>Spotify · YouTube Music · Deezer · TIDAL · Apple Music · SoundCloud · Arquivo</p>
  <p>
    <a href="https://github.com/nicolassmotta/sync-sphere/actions/workflows/ci.yml"><img src="https://github.com/nicolassmotta/sync-sphere/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI: testes, lint, build e verificação da aplicação" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/licen%C3%A7a-MIT-1DB954" alt="Licença MIT" /></a>
    <a href="docs/integrations.md"><img src="https://img.shields.io/badge/plataformas-7-FF0033" alt="Sete plataformas" /></a>
  </p>
  <p><a href="#comece-em-poucos-passos">Começar</a> · <a href="docs/README.md">Documentação</a> · <a href="CONTRIBUTING.md">Contribuir</a> · <a href="docs/media-kit.md">Divulgar</a></p>
</div>

SyncSphere migra referências e metadados de playlists entre serviços de música e arquivos. Escolha origem e destino, acompanhe a transferência em tempo real e revise as músicas que precisarem de uma escolha manual.

Você hospeda o aplicativo no próprio computador. A fila, o histórico e as credenciais ficam em armazenamento local cifrado. O painel abre diretamente, sem conta do SyncSphere, banco de dados ou Redis.

![Página inicial do SyncSphere com apresentação dos provedores e fluxo local](docs/assets/overview.jpg)

*Captura do aplicativo em uma instalação de demonstração. O fluxo Arquivo -> Arquivo funciona sem conectar serviços de música.*

> Esta documentação acompanha a `main`, com a versão **1.1.0 preparada e ainda não publicada**. A versão publicada está em [Releases](https://github.com/nicolassmotta/sync-sphere/releases). Veja as [notas da 1.1.0](docs/releases/v1.1.0.md).

## Por que usar

- **Escolha o fluxo:** sete provedores com leitura e escrita, conforme as credenciais e o catálogo disponíveis.
- **Comece sem contas:** importe uma playlist e converta entre CSV, JSON, M3U/M3U8 e TXT.
- **Acompanhe cada faixa:** progresso, tempo estimado, pausas automáticas, reconexão e pendências.
- **Evite buscas repetidas:** correspondências confiáveis ficam em cache cifrado por sete dias.
- **Revise o resultado:** ajuste título e artista, confira uma alternativa e confirme a inserção no Histórico.
- **Retome com cuidado:** os destinos comparam quantidades antes de inserir; o armazenamento local usa substituição atômica de arquivos.

## Comece em poucos passos

Tenha Git e Node.js com npm instalados. Recomendamos **Node.js 22 ou 24 LTS**; o requisito técnico atual é Node.js 20+. Consulte as [versões do Node.js](https://nodejs.org/en/about/previous-releases).

```bash
git clone https://github.com/nicolassmotta/sync-sphere.git
cd sync-sphere
npm run setup
cp backend/.env.example backend/.env
npm start
```

No PowerShell, substitua a cópia por:

```powershell
Copy-Item backend/.env.example backend/.env
```

Abra **[http://localhost:8000](http://localhost:8000)**. Para testar agora, escolha **Arquivo** como origem e destino, importe [a playlist de exemplo](docs/examples/playlist.csv), selecione-a e inicie a transferência. O Histórico oferece o download nos formatos disponíveis.

Para migrar entre serviços, configure apenas as plataformas escolhidas em **Integrações**. O [guia de instalação](docs/getting-started.md) mostra o passo a passo completo.

## Plataformas e conexão

| Plataforma | Leitura | Escrita | O que configurar |
|---|---|---|---|
| Spotify | Conta conectada; links sujeitos às permissões da API | Conta conectada | App Spotify, Client ID e OAuth com PKCE |
| YouTube Music | Cookie da conta; link de YouTube Music ou YouTube | Cookie da conta | Cabeçalho Cookie completo, colado no painel |
| Deezer | Playlists públicas sem login; conta e privadas com cookie | Cookie da conta | `arl` para operações autenticadas |
| TIDAL | OAuth; leitura pública com configuração de app compatível | OAuth | App TIDAL e autorização da conta |
| Apple Music | Catálogo público; biblioteca com autorização | Biblioteca autorizada | MusicKit ou token da conta pelo fluxo alternativo |
| SoundCloud | Playlists públicas sem login; conta com token | Token da conta | `oauth_token` para operações autenticadas |
| Arquivo | CSV, JSON, M3U/M3U8 e TXT | Os mesmos formatos | Nenhuma credencial |

Confira autenticação, privacidade e limites no [guia das integrações](docs/integrations.md).

## O que esperar das migrações

A correspondência depende do catálogo do destino. O aplicativo compara metadados e usa ISRC quando o provedor o suporta. Algumas músicas podem precisar de revisão manual ou ficar sem correspondência.

- Spotify e TIDAL usam APIs oficiais nos seus adaptadores. YouTube Music e SoundCloud usam APIs do site. Deezer combina leitura pública com gateway não oficial; Apple Music oferece MusicKit e um fluxo alternativo não oficial.
- As escritas reais em **Deezer, TIDAL, Apple Music e SoundCloud** ainda precisam de confirmação com credenciais de conta. Os testes automatizados dessas escritas usam respostas simuladas.
- Faixas recuperadas depois entram no fim das playlists remotas. Arquivos exportados seguem a ordem das faixas resolvidas da origem.
- A criptografia protege os arquivos locais; acesso ao aplicativo e à máquina precisa ser protegido. Veja [SECURITY.md](SECURITY.md).

Os [limites documentados](docs/usage.md#limites-atuais) ajudam a escolher o tamanho e o destino de cada transferência.

## Documentação

| Quero… | Guia |
|---|---|
| Instalar e testar sem conectar uma conta | [Primeiros passos](docs/getting-started.md) |
| Conectar uma plataforma | [Integrações](docs/integrations.md) |
| Configurar portas, credenciais e fila | [Configuração](docs/configuration.md) |
| Migrar, retomar ou revisar uma faixa | [Como usar](docs/usage.md) |
| Preparar um arquivo de playlist | [Formatos de arquivo](docs/file-formats.md) |
| Resolver um erro | [Solução de problemas](docs/troubleshooting.md) |
| Entender o código e a API local | [Arquitetura](docs/architecture.md) · [API](docs/api.md) |
| Contribuir ou acompanhar as fases | [Contribuição](CONTRIBUTING.md) · [Plano das fases](docs/roadmap.md) |
| Apresentar o projeto | [Materiais de divulgação](docs/media-kit.md) |

## Desenvolvimento

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm test
npm run lint
npm run build
```

Para desenvolvimento com atualização automática, use `npm run dev:backend` e `npm run dev:frontend` em terminais separados. Os detalhes de portas e CORS estão no [guia de contribuição](CONTRIBUTING.md).

O CI executa testes do backend, lint e build do frontend e uma verificação da aplicação empacotada. Os testes de integrações externas usam respostas simuladas e diretórios temporários isolados.

## Participar

Encontrou um problema? Abra uma [issue](https://github.com/nicolassmotta/sync-sphere/issues/new/choose) com passos para reproduzir e exemplos sem credenciais. Para propor uma mudança, consulte [CONTRIBUTING.md](CONTRIBUTING.md). Relatos de vulnerabilidades seguem [SECURITY.md](SECURITY.md).

Se o projeto for útil, uma estrela no repositório e o compartilhamento do [material de divulgação](docs/media-kit.md) ajudam outras pessoas a encontrá-lo.

## Licença

[MIT](LICENSE), por Nicolas Cardoso Motta. Os nomes dos serviços identificam as integrações disponíveis; o SyncSphere é um projeto independente.
