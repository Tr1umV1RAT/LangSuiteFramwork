# v16 — Recentrage UX mono-graphe

## Portée

Passe de recentrage sur la base v15 pour redonner la priorité au workflow LangGraph/LangChain simple, sans supprimer la couche multi-artefacts introduite par les versions récentes.

## (A) Observed

- Le runtime réel reste LangGraph-first.
- La v15 conserve les capacités historiques (graphe visuel, run panel, blocs, LLM, mémoire, RAG, bindings), mais leur lecture est diluée par la surcouche artefacts / wrappers / profils.
- Les cartes de nœuds et panneaux latéraux exposent beaucoup d'informations conceptuelles dès le premier niveau.
- Le Run Panel était surtout un panneau de logs/JSON, moins une surface I/O claire pour un usage mono-graphe direct.

## (B) Inferred

- La perte principale était une perte de hiérarchie visuelle et cognitive, davantage qu'une perte fonctionnelle.
- Il fallait réintroduire un chemin “simple” sans casser la structure v15.
- La meilleure stratégie n'était pas de supprimer la couche avancée, mais de la rendre optionnelle / progressive.

## (C) Implemented

### 1. Mode d'éditeur simple / avancé
Ajout d'un `editorMode` (`simple` | `advanced`) dans le store Zustand, avec persistance `localStorage`.

### 2. Toolbar recentrée
Ajout d'un sélecteur visible :
- **Graph simple**
- **Suite**

### 3. Palette de blocs
`BlocksPanelContent` a été réécrit :
- mode simple :
  - palette “mono-graphe”
  - quick-start buttons pour blocs essentiels
  - filtrage orienté “blocs naturels”
  - artefacts/wrappers avancés repliés
- mode avancé :
  - conserve la bibliothèque d'artefacts et les regroupements conceptuels

### 4. Panneau Variables / État
`StatePanelContent` a été restructuré :
- mode simple :
  - Vue rapide
  - Variables détectées
  - Schéma personnalisé
  - Bindings
  - Nœuds IA
  - réglages avancés repliés
- mode avancé :
  - conserve les sections scope/exécution/runtime/publication

### 5. Cartes de nœuds
`CustomNode` simplifie l'affichage en mode simple :
- conserve les informations utiles (id, sync/async, provider/model/tools)
- remplace la couche de badges conceptuels complète par un résumé court

### 6. Run Panel
`RunPanel` a été réécrit en trois vues :
- Entrées
- Exécution
- JSON

Le panel expose mieux :
- message initial
- état courant
- reprise après pause/interruption
- logs détaillés

## Fichiers modifiés

- `client/src/store.ts`
- `client/src/components/Toolbar.tsx`
- `client/src/components/SidePanelSystem.tsx`
- `client/src/components/BlocksPanelContent.tsx`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/CustomNode.tsx`
- `client/src/components/RunPanel.tsx`

## Limites

- Pas de QA navigateur manuelle dans cette passe.
- Les wrappers et le supergraph ne sont pas encore davantage formalisés fonctionnellement.
- Le runtime reste LangGraph-first ; la distinction “advanced suite” reste surtout une couche UI/produit.
