# Handoff v16 — UX recentrage base

## État actuel

La base compile/build correctement et dispose maintenant d'un **double mode d'usage explicite** :
- `simple` : recentré mono-graphe
- `advanced` : conserve la lecture LangSuite / artefacts

## Ce qui a été fait

- `editorMode` dans le store + persistance locale
- toolbar avec bascule de mode
- palette reconfigurée pour usage simple
- panneau Variables/État restructuré
- cartes de nœuds simplifiées en mode simple
- run panel recentré sur I/O

## Priorités logiques suivantes

1. QA navigateur réelle
   - palette simple
   - quick-start buttons
   - run panel
   - state panel
   - badges de nœuds
   - persistance du mode simple/advanced

2. Rendre le mode simple encore plus cohérent
   - éventuellement masquer certains types d'artefacts non-graph en mode simple
   - renforcer une “surface graph pur” au niveau TabBar / ProjectManager

3. Formaliser les wrappers
   - transparent / semi-opaque / opaque
   - contrat IO exposé
   - UI explicite de wrapping

4. Supergraph
   - expliciter au niveau modèle/UI/runtime
   - pas encore traité dans cette passe

## Risques / points d'attention

- `StatePanelContent` a été fortement restructuré : surveiller l'ergonomie réelle en navigateur
- le mode simple simplifie la lecture, mais il ne change pas la vérité runtime sous-jacente
- aucun test E2E navigateur n'a été joué ici
