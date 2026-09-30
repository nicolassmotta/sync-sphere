# Solução de problemas

[Índice da documentação](README.md)

## Começar pelo servidor

Confira o terminal do backend e as duas rotas:

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/ready
```

No PowerShell, use `curl.exe` se necessário. Se não houver resposta, confirme a porta configurada e mantenha `npm start` em execução.

## Diagnóstico por sintoma

| Sintoma | Verificação e ação |
|---|---|
| `npm` ou `node` não encontrado | Instale Node.js com npm e abra um terminal novo. Confira `node --version`. |
| Porta já em uso | Pare a outra instalação ou escolha outra `PORT`; ajuste origem e retornos OAuth. |
| Interface ausente ou antiga | Rode `npm run build` na raiz e reinicie. O backend serve `frontend/dist`. |
| Vite não alcança a API | Confira `VITE_API_URL`, a porta do backend e a origem em `FRONTEND_URL`/`FRONTEND_URLS`. |
| Erro de CORS | Cadastre a origem exata do navegador, incluindo esquema e porta, e reinicie o backend. |
| Spotify retorna erro de callback | Use `127.0.0.1` no callback; confira se a URI é idêntica no app Spotify e no `.env`. |
| Spotify recusa playlist de terceiros | Confira as permissões e restrições do app. Teste uma playlist pertencente à conta conectada. |
| Spotify não consegue escrever | Reconecte para autorizar os escopos de criação e modificação de playlists. |
| Cookie do YouTube Music incompleto | Copie o cabeçalho Cookie completo de uma requisição logada em `music.youtube.com`. |
| Credencial expirou | Atualize a plataforma em Integrações. O fluxo aguardando reconexão pode ser retomado. |
| Plataforma limitou buscas | Aguarde a pausa automática. Evite aumentar concorrência; uma retomada imediata pode manter o bloqueio. |
| Transferência fica na fila | Confira `WORKER_ENABLED=true`, reinicie e veja o estado no Histórico. |
| Faixa não encontrada | Revise catálogo e metadados. Após o fim da transferência, use Escolher alternativa no Histórico. |
| Proposta manual expirou | Faça uma nova busca; a proposta tem validade de dez minutos. |
| Arquivo recusado | Confira formato, cabeçalho de nome, tamanho de até 5 MB e até 5.000 faixas. |
| SoundCloud sem `client_id` | A obtenção pelo site pode ter mudado. Configure `SOUNDCLOUD_CLIENT_ID` ou relate o erro sem credenciais. |
| Apple Music sem token público | Confira a opção automática, configure MusicKit ou um token válido pelo método disponível. |

## Progresso parou de atualizar

O painel usa Socket.io. Recarregue a página e confira se o backend segue rodando. Em Vite, a origem permitida precisa valer também para o socket. Em proxy reverso, o transporte de Socket.io precisa ser encaminhado.

O Histórico mostra o estado persistido. Confira-o antes de iniciar outra transferência da mesma playlist.

## Credencial permanece após desconectar

O painel remove a credencial que salvou localmente. Se houver um valor equivalente no `.env`, ele pode continuar sendo usado. Remova esse valor e reinicie o backend se a intenção for desconectar completamente.

## Dados sumiram após atualização

Confira se `DATA_DIR` aponta para o diretório anterior e se a chave de criptografia é a mesma. O leitor atual devolve o estado padrão se não conseguir decifrar ou ler um arquivo, então uma chave diferente pode fazer a instalação parecer vazia.

Pare o servidor antes de investigar. Preserve os arquivos e o backup original; não gere outra chave sobre uma instalação que deseja recuperar. Veja [Segurança](../SECURITY.md).

## Limpar histórico de uma instalação de teste

Com o servidor parado, na raiz:

```bash
npm run history:clear --prefix backend
```

O comando apaga histórico, fila e estado por faixa. Ele mantém credenciais, chave, cache, importações e exportações. Faça backup se houver dados que deseja conservar.

## Pedir ajuda

Abra uma [issue](https://github.com/nicolassmotta/sync-sphere/issues/new/choose) com versão ou commit, sistema operacional, Node.js, plataformas envolvidas, passos e mensagem de erro. Prefira uma playlist pequena com dados fictícios.

Remova cookies, tokens, chaves e links privados das evidências. Para uma vulnerabilidade, siga [SECURITY.md](../SECURITY.md).
