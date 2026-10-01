# Backup e restauração

[Índice da documentação](README.md)

Um backup protegido permite levar os dados persistidos pelo SyncSphere para outra instalação ou recuperar um estado anterior. O arquivo inclui credenciais sensíveis, mesmo que esteja cifrado: guarde-o com cuidado.

## Criar pelo painel

1. Espere a fila terminar. Jobs pausados também impedem criar o backup guiado.
2. Abra **Ajuda e segurança > Criar backup protegido**.
3. Escolha uma senha de pelo menos 12 caracteres e repita-a.
4. Use **Proteger e baixar**.
5. Guarde o arquivo `.ssb` e a senha em locais seguros, separados.

A senha não é salva no aplicativo e não pode ser recuperada. O backup usa uma chave derivada por scrypt e cifra AES-256-GCM, independente da chave local da instalação.

Entram no pacote: credenciais persistidas, Client IDs salvos pelo painel, histórico, fila, estado por faixa, importações e exportações. Não entram `.env`, chaves locais, logs, cache ou estatísticas descartáveis. Configurações exclusivas do `.env` precisam ser mantidas separadamente. O limite do conteúdo é 64 MB; dados maiores são recusados explicitamente.

## Restaurar no pacote portátil

1. Encerre o aplicativo. Não basta fechar a aba: encerre também a janela de Iniciar.
2. Guarde uma cópia da instalação atual.
3. Abra **Restaurar-backup** na pasta do pacote.
4. Informe o caminho do arquivo `.ssb`.
5. Digite **RESTAURAR** para confirmar que os dados locais serão substituídos.
6. Informe a senha. Ela não aparece no terminal.
7. Abra Iniciar novamente e confira o Histórico e as conexões.

Credenciais de sessão restauradas podem estar vencidas. Autorize novamente quando o aplicativo pedir. A restauração não altera playlists nas contas externas.

## Restaurar na instalação pelo código

Na raiz do repositório:

```bash
npm run backup:restore -- --interactive
```

Também é possível indicar o arquivo diretamente, com confirmação explícita:

```bash
npm run backup:restore -- caminho/backup.ssb --confirm
```

A senha é solicitada no terminal, nunca como argumento do comando. `BACKUP_PASSWORD` existe para testes e automação local controlada; prefira a entrada interativa no uso normal.

`DATA_DIR` e `DOTENV_CONFIG_PATH` selecionam o mesmo diretório e ambiente usados pelo servidor. Confira a instalação antes de confirmar a substituição.

## Proteções e limites

O pacote inteiro é decifrado e validado antes de substituir os dados. A restauração recifra as coleções com a chave da instalação de destino; não exige copiar a chave original do servidor que criou o backup.

Um bloqueio exclusivo em `server.lock` impede restaurar enquanto o servidor estiver usando aquele diretório. Um diário cifrado guarda os bytes anteriores durante a operação. Falhas revertem a alteração; uma restauração interrompida é desfeita no próximo boot antes de abrir as coleções. Se a recuperação falhar, preserve os arquivos e o backup antes de tentar novamente.

Essas proteções não substituem cópias em outro dispositivo, nem garantem recuperação de danos no disco. Não restaure backups de procedência desconhecida. O backup protegido contém apenas o estado local, sem uma transação distribuída com as plataformas de música.
