# Backend do SyncSphere

API Express em ESM, Socket.io, provedores de música e fila persistida no processo. A aplicação empacotada também serve o build React em `http://localhost:8000`.

## Executar em desenvolvimento

Na raiz do repositório:

```bash
npm ci --prefix backend
cp backend/.env.example backend/.env
npm run dev:backend
```

No PowerShell, use `Copy-Item backend/.env.example backend/.env`. Mantenha credenciais opcionais vazias para trabalhar com Arquivo. Recomenda-se Node.js 22 ou 24 LTS; o requisito técnico atual é 20+.

Para usar o aplicativo empacotado, siga [Primeiros passos](../docs/getting-started.md).

## Guias

- [Configuração](../docs/configuration.md): ambiente, portas, regiões e fila.
- [Integrações](../docs/integrations.md): métodos de conexão de cada plataforma.
- [Arquitetura](../docs/architecture.md): contrato dos provedores, processamento e armazenamento.
- [API local](../docs/api.md): rotas HTTP e eventos de progresso.
- [Segurança](../SECURITY.md): chaves, backups e proteção de acesso.
- [Contribuição](../CONTRIBUTING.md): fluxo de mudança e validação.

## Comandos deste diretório

| Comando | Uso |
|---|---|
| `npm run dev` | Servidor com reinício automático via nodemon. |
| `npm start` | Servidor sem observador de arquivos. |
| `npm test` | Testes com Jest e respostas externas simuladas. |
| `npm run test:watch` | Testes durante desenvolvimento. |
| `npm run history:clear` | Apagar histórico, fila e estado por faixa, com o servidor parado. |

O comando de limpeza mantém credenciais, chave, cache e biblioteca de arquivos. Faça backup quando os dados importarem.

Os testes usam diretórios temporários separados. O diretório normal `backend/data/` é ignorado pelo Git. Não remova ou troque a chave ao reutilizar dados existentes.
