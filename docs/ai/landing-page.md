# Página pública

A página de apresentação fica em `site/` e vai para o GitHub Pages em `https://nicolassmotta.github.io/sync-sphere/`. É HTML e CSS estáticos, sem build e sem dependências.

## Arquivos

- `site/index.html`: página em português. `site/en/index.html`: mesma página em inglês. Mudou um texto, mude os dois.
- `site/styles.css`: estilos compartilhados. Usa a identidade do painel: fonte Sora (servida de `site/fonts/` com a licença OFL), fundo `#070808`, verde da origem `#1DB954` e vermelho do destino `#FF0033`.
- `site/download.js`: detecta o sistema e consulta `releases/latest` na API do GitHub para apontar cada botão ao pacote certo, com tamanho e versão. Sem JavaScript ou sem resposta da API, os links levam à página de Releases. A versão só aparece quando a Release tem pacotes.
- `site/img/`: captura do painel e imagem de compartilhamento (`social.jpg`, 1200x628).

Os nomes dos pacotes seguem `syncsphere-<versão>-<alvo>.zip|tar.gz`, gerados por `scripts/package-local.mjs`. Se esse padrão mudar, ajuste `download.js`.

## Conteúdo que precisa continuar verdadeiro

- O Spotify exige app de desenvolvedor próprio, com conta dona Premium desde fevereiro de 2026.
- Deezer, TIDAL, Apple Music e SoundCloud aparecem como experimentais até a escrita ser conferida com contas reais. Não troque com base em testes simulados.
- O aviso de que o projeto não é afiliado às plataformas fica no rodapé das duas versões.
- Os pacotes não são assinados; a seção sobre a confirmação do Windows e do macOS deve acompanhar o que o sistema mostra.

## Publicar

A publicação depende de confirmação explícita do mantenedor.

1. Na primeira vez, em **Settings > Pages** do repositório, escolha **GitHub Actions** como fonte.
2. Com a mudança na `main`, rode o workflow **Página** pela aba Actions (ou `gh workflow run pages.yml --ref main`).
3. Confira a página publicada nas duas línguas e os botões de download.

Em pull requests que mexem em `site/`, o workflow só confere se os arquivos referenciados existem e monta o artefato, sem publicar.

Para ver localmente: `python3 -m http.server --directory site`, e abra o endereço mostrado.
