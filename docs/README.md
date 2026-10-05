# Documentação do SyncSphere

[Português (Brasil)](README.md) · [English](en/README.md)

Esta documentação acompanha a versão da `main`. Para instalar uma versão publicada, confira [Releases](https://github.com/nicolassmotta/sync-sphere/releases) e suas notas. A versão 1.1.0 está preparada e ainda não publicada.

## Usar o aplicativo

- [Sua primeira migração](primeira-migracao.md): fluxo guiado, demonstração integrada e resultado.
- [Backup e restauração](backups.md): cópia cifrada por senha e recuperação com o aplicativo fechado.
- [Pacotes portáteis](distribution.md): iniciador e geração local de pacotes com Node.js incluído.

- [Idiomas](localization.md): preferência, catálogos e mensagens HTTP.
- [Primeiros passos](getting-started.md): instalação, execução local e demonstração sem contas.
- [Integrações](integrations.md): autenticação, capacidades e privacidade dos sete provedores.
- [Configuração](configuration.md): variáveis, portas, fila e armazenamento.
- [Como usar](usage.md): transferências, retomadas, revisão manual e limites atuais.
- [Formatos de arquivo](file-formats.md): CSV, JSON, M3U/M3U8 e TXT.
- [Solução de problemas](troubleshooting.md): diagnóstico por sintoma.

## Desenvolver e contribuir

- [Contribuição](../CONTRIBUTING.md): ambiente de desenvolvimento, testes e fluxo de PR.
- [Auditoria de rotas e usabilidade](qa-audit.md): cenários simulados, correções e limites de validação.
- [Arquitetura](architecture.md): provedores, fila, armazenamento e componentes.
- [API local](api.md): rotas e eventos Socket.io.
- [Segurança](../SECURITY.md): proteção da instalação e relato de vulnerabilidades.
- [Conferência com pessoas](usability-testing.md): roteiro de tarefas e registro de dificuldades.
- [Plano das fases](roadmap.md): entregas integradas e validações pendentes.
- [Validação de correspondência](validation-matching-quality.md): amostra, política, revisão, cache e integridade.
- [Plano de correspondência robusta](plano-correspondencia-robusta.md): busca progressiva, revisão de alternativas, relatórios e integridade da playlist.
- [Notas da 1.1.0](releases/v1.1.0.md): mudanças, atualização e limites da versão.

## Apresentar o projeto

- [Materiais de divulgação](media-kit.md): descrição, textos prontos, imagens e roteiro de demonstração.
- [README principal](../README.md): apresentação rápida do projeto.

## Manter a documentação

As variáveis de ambiente têm seus nomes e exemplos em [backend/.env.example](../backend/.env.example). O contrato técnico dos provedores está em [registry.js](../backend/src/providers/registry.js). Preserve essas fontes ao atualizar os guias.

O contexto de manutenção assistida fica em [ai/README.md](ai/README.md). Ele é opcional para usar ou contribuir com o aplicativo.
