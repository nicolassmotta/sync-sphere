# Processo de Release

Use este checklist para publicar uma versão do SyncSphere:

Preparação e publicação são etapas distintas. Para a versão 1.1.0, mantenha as notas em `docs/releases/v1.1.0.md` e o changelog marcado como preparação até a publicação ser solicitada.

1. Confirme `main` alinhada com `origin/main` e preserve mudanças locais fora do escopo.
2. Alinhe a versão em `package.json`, `backend/package.json`, `frontend/package.json` e lockfiles.
3. Atualize `CHANGELOG.md` com data, destaques, correções e avisos de compatibilidade.
4. Rode `npm test`, `npm run lint`, `npm run build` e o smoke test do app servido pelo back-end.
5. Confirme `npm audit --omit=dev` em `backend/` e `frontend/`.
6. Faça commit com Conventional Commits em uma branch de release, abra PR para `main` e aguarde o workflow `CI` concluir.
7. Faça merge da PR. Quando a publicação for solicitada, finalize a data e o estado das notas, valide o commit de publicação e crie uma tag anotada `vX.Y.Z` nesse commit.
8. Aguarde o `CI` da tag e publique uma GitHub Release com as notas do changelog.
9. Verifique a release, a tag remota e o workflow associado.

Nunca inclua `.env`, `backend/data/`, cookies, tokens ou chaves nos artefatos e notas.
