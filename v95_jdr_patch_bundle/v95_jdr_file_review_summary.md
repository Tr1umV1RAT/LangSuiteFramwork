# v95 JDR Demo Branch — Diff Summary by File

Ce document sert de support de revue rapide. Pour chaque fichier ajouté ou modifié dans le patch JDR, il indique :
- l'objectif
- la zone modifiée
- l'impact fonctionnel
- le risque éventuel

---

## 1) `artifact_registry/graphs/jdr_solo_session_starter.json`

**Type** : ajout

**Objectif**
- Introduire un starter JDR jouable, directement sur la surface runtime `LangGraph` existante.
- Préseed l'expérience avec les briques JDR minimales : GM, outils, modules, prompt strips, cast PNJ, contexte de session.

**Zone modifiée**
- Nouveau manifeste d’artefact dans le registre des graphes.
- Définition du graphe de départ.
- Définition des `runtimeSettings` embarqués.
- Définition des modules JDR, strips de prompts, affectations, casts et contexte.

**Impact fonctionnel**
- Rend disponible un point de départ JDR réel, ouvrable, éditable, compilable et exécutable sur le rail existant.
- Sert de base au builder guidé.
- Démonstre concrètement le seam `prompt strips + module library + subagents + starter refs`.

**Risque éventuel**
- Moyen.
- Risque de dérive si le manifeste n’est plus aligné avec les schémas de nœuds/outils attendus.
- Risque de maintenance si trop de contenu métier JDR est codé directement ici au lieu d’être ensuite refactorisé en packs plus propres.

---

## 2) `client/src/App.tsx`

**Type** : modification

**Objectif**
- Exposer l’entrée principale JDR dans l’UI.
- Brancher le dialogue guidé tabletop.
- Ajouter un résumé visuel de la session JDR active.

**Zone modifiée**
- Zone empty-state / quickstart.
- Actions d’ouverture de starter.
- Intégration du dialogue `TabletopStarterDialog`.
- Overlay ou résumé de contexte JDR actif.

**Impact fonctionnel**
- L’utilisateur peut démarrer une session JDR sans passer par un montage manuel du graphe.
- L’entrée JDR devient visible et cohérente avec l’orientation UX de la branche.

**Risque éventuel**
- Faible à moyen.
- Risque d’encombrement de l’écran d’accueil si trop d’entrées concurrentes s’accumulent.
- Risque de couplage UI si les éléments JDR sont injectés directement au lieu de rester optionnels.

---

## 3) `client/src/components/SettingsShell.tsx`

**Type** : modification

**Objectif**
- Ajouter un preset d’interface dédié à la branche JDR.

**Zone modifiée**
- Liste des presets affichés dans les réglages.
- Présentation/description du preset `tabletop_demo`.

**Impact fonctionnel**
- L’utilisateur peut choisir un environnement d’édition plus adapté à un usage session/tabletop.
- Aucun effet sur le runtime, la compilation ou les contrats providers.

**Risque éventuel**
- Faible.
- Principal risque : confusion sémantique entre preset UI et profil d’exécution si la formulation devient ambiguë.

---

## 4) `client/src/components/StatePanelContent.tsx`

**Type** : modification

**Objectif**
- Rendre les `starterRefs` réellement exploitables depuis l’interface.

**Zone modifiée**
- Rendu du panneau d’état pour les modules / starters référencés.
- Ajout d’une action explicite `Open starter`.

**Impact fonctionnel**
- Les références de starters cessent d’être passives.
- L’utilisateur peut ouvrir un starter lié à un module sans action implicite cachée.

**Risque éventuel**
- Faible à moyen.
- Risque de confusion si l’ouverture d’un starter est interprétée comme un chargement de campagne ou une installation de module.
- Risque UX si le bouton n’indique pas clairement qu’il ouvre une copie éditable.

---

## 5) `client/src/components/TabBar.tsx`

**Type** : modification

**Objectif**
- Marquer visuellement les onglets JDR/tabletop.

**Zone modifiée**
- Rendu des badges ou indicateurs d’onglet.
- Intégration d’indices visuels dérivés du contexte JDR actif.

**Impact fonctionnel**
- Améliore la lisibilité lorsqu’un workspace mélange plusieurs types d’artefacts.
- Renforce l’identité de la branche sans modifier les comportements métier.

**Risque éventuel**
- Faible.
- Risque essentiellement cosmétique : surcharge visuelle ou collisions de styles avec d’autres badges existants.

---

## 6) `client/src/components/TabletopStarterDialog.tsx`

**Type** : ajout

**Objectif**
- Fournir une expérience guidée de création de session JDR.

**Zone modifiée**
- Nouveau composant de dialogue.
- Formulaire de sélection : setting, cast, règles, ton, provider, modèle, env var, base URL.
- Actions de validation / annulation.

**Impact fonctionnel**
- Permet de composer une session JDR à partir d’options bornées au lieu d’éditer le graphe à la main.
- Rend le patch beaucoup plus présentable en démonstration.

**Risque éventuel**
- Moyen.
- Risque de divergence entre options visibles dans le dialogue et capacités réellement couvertes par le builder.
- Risque de maintenance si le composant encode trop de logique métier au lieu de déléguer au store.

---

## 7) `client/src/components/artifacts/ArtifactLibrarySection.tsx`

**Type** : modification

**Objectif**
- Améliorer la découvrabilité du starter JDR depuis la bibliothèque d’artefacts.

**Zone modifiée**
- Rendu des sections ou callouts de la bibliothèque.
- Mise en avant du starter tabletop et/ou de l’accès guidé.

**Impact fonctionnel**
- Réduit la dépendance à l’écran d’accueil pour découvrir la feature JDR.
- Rend la branche plus cohérente pour un utilisateur qui explore d’abord la bibliothèque.

**Risque éventuel**
- Faible.
- Risque d’ajouter un traitement spécial trop ad hoc si d’autres branches/domaines doivent ensuite faire de même.

---

## 8) `client/src/index.css`

**Type** : modification

**Objectif**
- Ajouter la couche de styles JDR/tabletop.

**Zone modifiée**
- Classes CSS liées aux badges, overlays, variantes fantasy/noir/space, résumé de session.

**Impact fonctionnel**
- Donne une identité visuelle claire à la branche.
- Rend les indices JDR visibles sans modifier les flux métier.

**Risque éventuel**
- Faible à moyen.
- Risque de régression visuelle globale si certaines classes sont trop génériques.
- Risque de dette CSS si les styles JDR ne restent pas bien encapsulés.

---

## 9) `client/src/jdr/theme.ts`

**Type** : ajout

**Objectif**
- Centraliser la logique de dérivation du thème/overlay JDR.

**Zone modifiée**
- Nouveau module utilitaire de thème.
- Déduction du profil de présentation à partir des modules chargés, `branchTargets`, `themeHints` ou setting actif.

**Impact fonctionnel**
- Évite de disperser la logique de thème JDR dans plusieurs composants.
- Facilite l’extension ultérieure vers d’autres univers JDR.

**Risque éventuel**
- Faible.
- Risque faible de logique de thème dupliquée si d’autres couches de présentation apparaissent ailleurs.

---

## 10) `client/src/store.ts`

**Type** : modification

**Objectif**
- Relier le flux JDR guidé au store principal.

**Zone modifiée**
- Actions store exposées au dialogue ou au builder.
- Intégration de l’ouverture de starter JDR et/ou du builder tabletop.

**Impact fonctionnel**
- Rend le dialogue et l’ouverture JDR réellement opérants depuis l’application.
- Garantit que le flux JDR utilise les rails de store existants au lieu d’un chemin parallèle.

**Risque éventuel**
- Moyen.
- Risque de couplage transversal si des helpers trop spécifiques JDR sont injectés au niveau racine du store.

---

## 11) `client/src/store/artifactHydration.ts`

**Type** : modification

**Objectif**
- Corriger la préservation de certains champs de configuration tool lors de l’hydratation/export.

**Zone modifiée**
- Mapping des propriétés d’outils lors de l’import/export/hydratation.
- Cas `sub_agent_tool` et `tool_llm_worker`.

**Impact fonctionnel**
- Préserve `api_base_url` et les paramètres utiles aux outils JDR dépendants d’un provider local ou distant.
- Évite une perte silencieuse de configuration entre ouverture, export ou reconstruction d’artefact.

**Risque éventuel**
- Moyen.
- Risque transversal, car ce fichier touche à l’hydratation d’artefacts au-delà de la seule branche JDR.
- Une erreur ici peut affecter d’autres outils non JDR.

---

## 12) `client/src/store/preferences.ts`

**Type** : modification

**Objectif**
- Ajouter la prise en charge du preset `tabletop_demo` dans les préférences persistées.

**Zone modifiée**
- Valeurs par défaut.
- Validation / normalisation / persistance des préférences d’interface.

**Impact fonctionnel**
- Le preset JDR devient stable et mémorisable dans l’application.

**Risque éventuel**
- Faible.
- Risque principal : mauvaise compatibilité si des préférences anciennes ne reconnaissent pas proprement la nouvelle valeur.

---

## 13) `client/src/store/tabletopStarter.ts`

**Type** : ajout

**Objectif**
- Implémenter la logique métier de construction guidée d’une session JDR.

**Zone modifiée**
- Nouveau module store/helper.
- Sélection des modules selon setting/cast/rules/tone.
- Réécriture des strips, cibles de sous-agents et configuration provider.
- Assemblage du graphe final à ouvrir.

**Impact fonctionnel**
- C’est le cœur fonctionnel du builder guidé.
- Permet de transformer un starter de base en session contextualisée sans nouveau backend.
- Réduit la logique métier présente dans le composant UI.

**Risque éventuel**
- Moyen à élevé.
- Zone sensible car elle assemble plusieurs surfaces à la fois : modules, strips, subagents, outils, provider config.
- Si la matrice de sélection évolue, ce fichier peut devenir rapidement complexe.

---

## 14) `client/src/store/types.ts`

**Type** : modification

**Objectif**
- Déclarer proprement les types nécessaires au preset JDR et au builder guidé.

**Zone modifiée**
- Types de préférences.
- Éventuels types de sélection tabletop.
- Éventuelles extensions de types de runtime settings ou métadonnées.

**Impact fonctionnel**
- Stabilise le contrat TypeScript autour des ajouts JDR.
- Réduit le risque de champs implicites ou mal typés dans les composants et helpers.

**Risque éventuel**
- Faible à moyen.
- Risque si les types sont trop spécifiques à la branche et deviennent difficiles à remonter dans le tronc ou à généraliser.

---

## 15) `client/src/store/workspace.ts`

**Type** : modification

**Objectif**
- Corriger la propagation effective des `promptStripAssignments` lors de l’ouverture d’un starter/artefact.

**Zone modifiée**
- Flux d’ouverture/hydratation de tab.
- Rebasing/rebinding des `tabId` dans les affectations de prompt strips.

**Impact fonctionnel**
- Corrige un problème structurel réel : les strips importés pouvaient exister dans l’état sans s’appliquer au bon tab.
- Rend le starter JDR réellement fonctionnel au niveau des prompts actifs.
- Potentiellement bénéfique au-delà du seul cas JDR.

**Risque éventuel**
- Moyen.
- Fichier central du workspace : une erreur peut perturber d’autres artefacts qui utilisent aussi les prompt strips.
- Doit rester aligné avec les tests v89–v94.

---

## 16) `tests/test_v95_jdr_starter_contract.py`

**Type** : ajout

**Objectif**
- Verrouiller le contrat minimal du starter JDR.

**Zone modifiée**
- Nouveau fichier de tests backend/contrat.
- Vérifications sur registre, mode, profil, runtime settings, outils et compile.

**Impact fonctionnel**
- Réduit le risque de casser la slice JDR au fil des évolutions.
- Documente implicitement ce que le patch considère comme non négociable pour la branche.

**Risque éventuel**
- Faible.
- Risque limité à un surcouplage si les assertions deviennent trop spécifiques à l’implémentation interne plutôt qu’au contrat observable.

---

# Lecture rapide par criticité

## Fichiers à risque fonctionnel plus élevé
- `artifact_registry/graphs/jdr_solo_session_starter.json`
- `client/src/store/artifactHydration.ts`
- `client/src/store/tabletopStarter.ts`
- `client/src/store/workspace.ts`

## Fichiers à risque principalement UX / présentation
- `client/src/App.tsx`
- `client/src/components/SettingsShell.tsx`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/TabBar.tsx`
- `client/src/components/artifacts/ArtifactLibrarySection.tsx`
- `client/src/index.css`
- `client/src/jdr/theme.ts`

## Fichiers de contractualisation / garde-fou
- `client/src/store/types.ts`
- `client/src/store/preferences.ts`
- `tests/test_v95_jdr_starter_contract.py`

---

# Conclusion de revue

Le patch JDR reste globalement **additif** et respecte bien la stratégie prévue :
- aucun nouveau runtime n’est introduit
- la branche s’appuie sur les surfaces existantes
- la valeur métier vient surtout de l’orchestration `starter + modules + prompt strips + subagents + runtime context`

Les zones les plus importantes à relire avec attention sont :
1. la cohérence du starter JSON
2. le builder `tabletopStarter.ts`
3. la correction de `workspace.ts` sur le rebinding des prompt strips
4. la correction d’hydratation/export dans `artifactHydration.ts`


## Hotfix v4.1 — GraphPayload edge validation fix

- Removed raw tool-origin edges from `artifact_registry/graphs/jdr_solo_session_starter.json`.
- Fixed `client/src/store.ts` export/build payload generation to exclude visual tool edges from API `edges`.
- Updated `tests/test_v95_jdr_starter_contract.py` to assert that starter artifact edges only reference real graph nodes and that export code filters non-API edges.
- User-facing symptom fixed: `GraphPayload` no longer raises `Edge source ... does not reference a known node` when building the JDR starter.


## Hotfix v4.2
- `client/src/store.ts`: prune stale tool edges and remove deleted tool IDs from `tools_linked` during node-removal changes.
- `artifact_registry/graphs/jdr_solo_session_starter.json`: rename visible dice tool label to `RPG Dice Roller`.


---

## Metadata/UI normalization note (v4.5)

A final normalization pass aligned the JDR starter's tool metadata across three surfaces:
- instance IDs
- UI labels
- internal descriptions

Applied convention:
- `tool_rpg_dice_roller_1` → label `RPG Dice Roller`
- `tool_sub_agent_cast_*` → labels `Cast Advisor · <Role>`
- `tool_llm_worker_rules_referee_1` → label `Structured Rules Referee`

Functional effect:
- the starter, guided builder, and review bundle now use the same naming language
- cast tool labels stay slot-stable while remaining readable in the UI
- rule-helper wording is now clearly separated from narration-facing labels

Regression risk:
- low
- mostly limited to UI copy expectations or tests that would hardcode old labels


## Hotfix v4.6 — Prompt assignment ID sanitization
- sanitized `promptStripAssignments[].id` generation to satisfy backend GraphPayload validation
- removed colon-bearing assignment IDs from guided tabletop module assembly path
- updated JDR contract test coverage for assignment ID sanitization helpers
