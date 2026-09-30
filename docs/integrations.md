# Integrações

[Índice da documentação](README.md)

Cada provedor implementa leitura, busca e criação de destino. Configure apenas os que pretende usar. **Leitura pública** permite carregar determinadas playlists sem conectar uma conta; escrita em serviços de música exige autorização.

## Visão geral

| Provedor | Método | Leitura sem conta | Privacidade criada |
|---|---|---|---|
| Spotify | API oficial, OAuth + PKCE | Não pelo fluxo de conta; acesso a links depende das permissões | Privada |
| YouTube Music | API não oficial do site, cookie | Exige cookie no fluxo de transferência | Privada |
| Deezer | API pública para leitura; gateway não oficial para conta e escrita | Playlists públicas | Privada |
| TIDAL | API oficial v2, OAuth + PKCE | Com Client ID e Client Secret, conforme acesso do app | Não listada |
| Apple Music | MusicKit ou fluxo alternativo do web player | Playlists do catálogo, com obtenção do token público habilitada | Biblioteca da conta |
| SoundCloud | API não oficial do site, token de sessão | Playlists públicas | Privada |
| Arquivo | Arquivos locais de metadados | Sim | Armazenamento local |

**Estado de validação:** escritas em Deezer, TIDAL, Apple Music e SoundCloud têm testes automatizados com respostas simuladas. A confirmação com contas reais continua pendente. Integrações não oficiais podem mudar sem aviso.

## Spotify

1. Crie ou abra um app no [painel de desenvolvedores](https://developer.spotify.com/dashboard).
2. Cadastre exatamente `http://127.0.0.1:8000/api/v1/integrations/spotify/callback` em **Redirect URIs**.
3. Defina `SPOTIFY_CLIENT_ID` no `backend/.env`.
4. Reinicie o servidor e use **Conectar Spotify** em Integrações.

O fluxo usa Authorization Code + PKCE e não requer Client Secret. Se mudar a porta, ajuste também `SPOTIFY_REDIRECT_URI` e o cadastro no Spotify.

No Development Mode, a conta proprietária do app precisa de Premium. Novos apps têm limite de cinco usuários; apps antigos podem preservar permissões anteriores. A API restringe o conteúdo de playlists que a conta não possui nem colabora. Consulte o [guia oficial vigente](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide).

Reconecte se a autorização antiga não tiver escopos de escrita. Cada instalação usa seu próprio app e sua conta, conforme o modelo local do SyncSphere.

## YouTube Music

1. Abra [music.youtube.com](https://music.youtube.com) com a conta escolhida.
2. Abra as ferramentas do navegador e a aba **Rede**.
3. Selecione uma requisição autenticada para `music.youtube.com`.
4. Copie o cabeçalho **Cookie completo**.
5. Cole no campo do YouTube Music em Integrações e salve.

Também é possível definir `YTMUSIC_COOKIE` no `.env` e reiniciar. O valor do painel tem prioridade. Copiar apenas um cookie isolado ou o cookie de `youtube.com` pode não fornecer a sessão necessária.

O provedor aceita links de `music.youtube.com` e `youtube.com` ou o ID da playlist. A playlist criada fica associada à mesma conta e pode aparecer nos dois serviços. O cookie pode expirar e precisar ser atualizado.

## Deezer

Playlists públicas e busca funcionam sem login. Para listar a conta, ler playlists privadas ou escrever:

1. Abra [deezer.com](https://www.deezer.com) e entre na conta.
2. Nas ferramentas do navegador, abra o armazenamento de cookies desse domínio.
3. Copie o valor de `arl`.
4. Cole no campo do Deezer em Integrações ou defina `DEEZER_ARL` no `.env`.

O painel valida a credencial ao salvar. A escrita usa o gateway interno do site, não uma API oficial de criação de playlists.

## TIDAL

1. Configure um app em [developer.tidal.com](https://developer.tidal.com).
2. Cadastre `http://127.0.0.1:8000/api/v1/integrations/tidal/callback` como retorno.
3. Defina `TIDAL_CLIENT_ID` no `.env`; ajuste `TIDAL_REDIRECT_URI` se necessário.
4. Reinicie e conecte a conta em Integrações.

`TIDAL_CLIENT_SECRET` é opcional e habilita o fluxo de credenciais do app para leitura pública e busca, conforme o acesso concedido ao app. A escrita continua exigindo autorização da conta.

O destino é criado como **não listado**, pois o adaptador usa esse nível de acesso da API v2. Não liste esse destino como privado ao compartilhar uma demonstração. Os contratos estão na [referência oficial da API](https://tidal-music.github.io/tidal-api-reference/).

## Apple Music

Playlists do catálogo podem ser lidas sem conectar a conta quando a obtenção automática do token público do web player está habilitada.

### MusicKit

Configure `APPLE_TEAM_ID`, `APPLE_KEY_ID` e `APPLE_PRIVATE_KEY_PATH` ou `APPLE_PRIVATE_KEY` no `.env`. Reinicie e use **Conectar com Apple Music**. A autorização da conta usa MusicKit JS. Consulte [MusicKit](https://developer.apple.com/musickit/) para a configuração da chave.

### Fluxo alternativo

No web player autenticado em [music.apple.com](https://music.apple.com), copie o cookie `media-user-token` e cole em Integrações. O formulário também aceita um developer token opcional. Sem chave própria, o aplicativo tenta obter o token público do web player, conforme `APPLE_MUSIC_AUTO_WEB_TOKEN`.

Esse caminho é não oficial e depende do funcionamento do site. A biblioteca e a escrita requerem um Music User Token válido. `APPLE_MUSIC_STOREFRONT` define a loja padrão; links do catálogo podem indicar outra loja.

## SoundCloud

Leitura de playlists públicas e busca usam o `client_id` público obtido do site. `SOUNDCLOUD_CLIENT_ID` permite definir esse identificador manualmente se a obtenção automática falhar.

Para listar a conta, ler privadas ou escrever, copie o valor do cookie `oauth_token` da sessão em [soundcloud.com](https://soundcloud.com) e salve em Integrações. A alternativa no `.env` é `SOUNDCLOUD_OAUTH_TOKEN`.

A busca exige artista em comum e ignora prévias curtas para reduzir trocas por covers ou uploads de terceiros. Algumas músicas podem ficar sem resultado. O adaptador usa a API do site, não a API oficial para aplicações.

## Arquivo

Importe CSV, JSON, M3U/M3U8 ou TXT no painel. As playlists importadas aparecem na seleção de origem. Use Arquivo também como destino para baixar a lista em outro formato pelo Histórico.

O conteúdo é persistido cifrado no diretório de dados. Não há upload para um serviço de música no fluxo Arquivo -> Arquivo. Confira os [formatos aceitos e exemplos](file-formats.md).

## Credenciais e desconexão

Credenciais de sessão dão acesso à conta da plataforma. Cole-as somente na instalação local e mantenha-as fora de capturas, issues e mensagens públicas. Desconectar no painel remove o valor salvo localmente; valores do `.env` precisam ser removidos do arquivo para deixar de ser usados.

Consulte [Configuração](configuration.md) para variáveis e [Solução de problemas](troubleshooting.md) para falhas de autorização.
