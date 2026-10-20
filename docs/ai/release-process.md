# Processo de Release

Use este checklist para publicar uma versão do SyncSphere:

Preparação e publicação são etapas distintas. Tag, Release e página no ar só acontecem com confirmação explícita do mantenedor. Até lá, mantenha o CHANGELOG com `## [X.Y.Z] - A publicar` e os avisos de "não publicada" nos READMEs.

O índice público está em [../README.md](../README.md), e a apresentação do projeto usa [../media-kit.md](../media-kit.md). Atualize o estado da versão nesses arquivos e nos guias de contribuição/segurança ao publicar.

1. Confirme `main` alinhada com `origin/main` e preserve mudanças locais fora do escopo.
2. Alinhe a versão em `package.json`, `backend/package.json`, `frontend/package.json` e lockfiles.
3. Atualize `CHANGELOG.md` com destaques, correções e avisos de compatibilidade, e escreva as notas em `docs/releases/vX.Y.Z.md`. As notas viram o corpo da Release: use só links relativos com `../` ou `../../`, que o workflow converte em links absolutos para a tag.
4. Rode `npm test`, `npm run lint`, `npm run build` e o smoke test do app servido pelo back-end.
5. Confirme `npm audit --omit=dev` em `backend/` e `frontend/`.
6. Faça commit com Conventional Commits em uma branch de release, abra PR para `main` e aguarde o `CI`. Se a PR mexer no empacotamento, o workflow `Release` também gera e abre os seis pacotes, sem publicar.
7. Quando a publicação for solicitada, em uma PR final: defina a data em `## [X.Y.Z] - AAAA-MM-DD` e troque os avisos de "em preparação" ou "não publicada" em `README.md`, `README.pt-BR.md`, `docs/README.md`, `docs/en/README.md`, `SECURITY.md`, `docs/en/security.md`, `docs/media-kit.md` e `docs/roadmap.md`.
8. Depois do merge, crie uma tag anotada `vX.Y.Z` no commit da `main` e envie a tag. O workflow `Release` confere versão, data e notas, roda o CI, gera os pacotes, abre cada um no próprio sistema e cria a GitHub Release com os pacotes e `SHA256SUMS.txt`.
9. Verifique a Release, os seis pacotes, a tag remota e o workflow. Se o workflow falhar antes de publicar, corrija na `main`, apague a tag remota e local e crie de novo no commit corrigido.

10. Confira README, links de instalação, requisitos externos e legendas das capturas. Preserve a distinção entre capacidades implementadas, validação simulada e operações em conta real.

Nunca inclua `.env`, `backend/data/`, cookies, tokens ou chaves nos artefatos e notas.
