# v95 JDR Demo Branch — Version Log

## Scope

Ce journal couvre le patch `v95-jdr-demo-branch-v2` et décrit les **ajouts** et **modifications** effectués pour transformer LangSuite en branche de démonstration JDR/TTRPG, tout en conservant les invariants du tronc principal :

- vérité des surfaces produit
- séparation save/open/import/export/compile/runtime
- vérité provider/runtime
- réutilisation des prompt strips
- réutilisation de la module library
- compatibilité additive avec la branche principale

---

## Résumé fonctionnel

Le patch implémente :

1. un **starter JDR jouable** sur la vraie surface `LangGraph`
2. une **expérience orientée table-top** dans l’UI
3. un **builder guidé de session JDR**
4. un **overlay visuel léger** selon l’univers choisi
5. un **helper de règles borné** sans inventer un nouveau moteur runtime
6. une **propagation correcte** des prompt strips, cibles de sous-agents, providers et base URLs
7. un **test de contrat** verrouillant le starter JDR

---

## Fichiers ajoutés

### 1) `artifact_registry/graphs/jdr_solo_session_starter.json`
Ajout d’un starter JDR natif sur la surface `langgraph_async`.

Contenu principal :
- graphe éditable ouvrable depuis l’UI
- nœud GM principal (`llm_chat`)
- outil de dés (`rpg_dice_roller`)
- outils de sous-agents pour le cast PNJ
- helper borné de règles / arbitrage
- `runtimeSettings` préseedés avec :
  - `moduleLibrary`
  - `loadedModuleIds`
  - `promptStripLibrary`
  - `promptStripAssignments`
  - `subagentLibrary`
  - `runtimeContext`

Modules inclus :
- univers
- ton
- règles
- persona GM
- casts PNJ
- utilitaires de session

### 2) `client/src/components/TabletopStarterDialog.tsx`
Ajout du dialogue guidé de création de session JDR.

Fonctions :
- sélection du setting
- sélection du cast
- sélection du style de règles
- sélection du ton
- sélection du provider / modèle / variable d’environnement / base URL
- ouverture d’un graphe éditable standard à partir du starter de base

### 3) `client/src/jdr/theme.ts`
Ajout d’une couche de thème JDR légère.

Fonctions :
- dérivation d’un profil visuel selon les modules chargés
- variantes fantasy / noir / space
- badges et métadonnées de présentation
- aucun changement des sémantiques runtime

### 4) `client/src/store/tabletopStarter.ts`
Ajout de la logique de construction guidée de session JDR.

Fonctions :
- clonage du starter de base
- chargement ciblé des modules choisis
- mise à jour des prompt strips et affectations
- réécriture des sous-agents et de leurs outils selon le cast sélectionné
- propagation des paramètres provider et modèle

### 5) `tests/test_v95_jdr_starter_contract.py`
Ajout du test de contrat v95.

Vérifie notamment :
- présence du starter JDR
- mode `langgraph`
- profil `langgraph_async`
- présence des bibliothèques modules / prompt strips / subagents
- présence d’un outil de dés
- présence d’outils de sous-agents
- compatibilité compile

---

## Fichiers modifiés

### 6) `client/src/App.tsx`
Modifié pour :
- exposer un point d’entrée visible vers le starter JDR
- intégrer l’ouverture du dialogue guidé tabletop
- afficher un résumé/badge contextualisé pour la session tabletop active

### 7) `client/src/components/SettingsShell.tsx`
Modifié pour ajouter un preset d’interface :
- `tabletop_demo`

But :
- simplifier l’environnement visuel de la branche JDR
- rester sur un preset d’UI, sans créer un nouveau rail runtime

### 8) `client/src/components/StatePanelContent.tsx`
Modifié pour rendre les `starterRefs` actionnables.

Ajout :
- bouton explicite `Open starter`

But :
- permettre l’ouverture directe d’un starter référencé
- sans auto-run
- sans installation cachée
- sans mutation implicite du workspace

### 9) `client/src/components/TabBar.tsx`
Modifié pour afficher un repère visuel tabletop sur les onglets JDR.

### 10) `client/src/components/artifacts/ArtifactLibrarySection.tsx`
Modifié pour améliorer la découvrabilité du starter JDR.

Ajouts :
- mise en avant de l’entrée tabletop
- accès orienté utilisateur à la configuration guidée

### 11) `client/src/index.css`
Modifié pour supporter les styles visuels de la branche JDR.

Ajouts :
- classes et variantes de présentation tabletop
- ajustements fantasy / noir / space
- badge/overlay léger

### 12) `client/src/store.ts`
Modifié pour connecter le flux guidé JDR au store principal.

### 13) `client/src/store/artifactHydration.ts`
Modifié pour préserver correctement certains champs d’outils lors de l’hydratation/export.

Correction importante :
- conservation de `api_base_url` sur `sub_agent_tool` et `tool_llm_worker`

### 14) `client/src/store/preferences.ts`
Modifié pour ajouter le preset `tabletop_demo` aux préférences d’interface.

### 15) `client/src/store/types.ts`
Modifié pour déclarer proprement les nouveaux types / presets utilisés par la branche JDR.

### 16) `client/src/store/workspace.ts`
Modifié pour corriger la propagation des affectations de prompt strips à l’ouverture d’un starter ou d’un artefact.

Correction importante :
- rebinding des `tabId` pour les `promptStripAssignments`

Impact :
- les prompt strips du starter JDR restent réellement actifs après ouverture
- évite un faux positif UX où les strips existent en état mais ne s’appliquent pas au bon tab

---

## Capacités JDR maintenant présentes

### Slice jouable implémentée
- **AI GM + 1 joueur humain + cast PNJ configurable**

### Univers disponibles
- frontier fantasy
- occult city
- space outpost

### Casts disponibles
- roadside cast
- investigator contacts
- station crew

### Modes de règles disponibles
- light narrative
- dice-forward

### Tons disponibles
- adventurous
- mystery
- grim

### Aides bornées
- lancer de dés
- sous-agents PNJ
- helper de règles / arbitrage par LLM worker
- contexte runtime de session

---

## Correctifs structurels importants

### Rebinding des prompt strips
Problème corrigé :
- les affectations importées depuis un starter restaient liées à l’ancien tab
- les strips n’étaient donc pas réellement actifs après ouverture

Correction :
- rebinding des `tabId` lors de l’ouverture/hydratation dans le store

### Propagation provider / base URL
Problème corrigé :
- certains outils perdaient leur `api_base_url` lors de l’hydratation ou de l’export

Correction :
- préservation explicite de ces champs sur les outils concernés

### Réécriture des cibles de cast
Problème corrigé :
- changer de cast ne pouvait pas se limiter à changer des prompts
- les outils sous-agents devaient aussi changer de cible et d’étiquette

Correction :
- le builder guidé réécrit les outils PNJ pour correspondre au cast choisi

---

## Ce qui a été volontairement laissé hors scope

Le patch **n’implémente pas** :
- moteur de combat complet
- simulation d’inventaire lourde
- moteur de carte / VTT
- plugin system arbitraire
- nouveau runtime JDR distinct
- campagne persistée comme nouveau modèle de sauvegarde
- hot swap provider inventé

---

## Validation effectuée

Tests annoncés dans l’itération précédente :
- `tests/test_v95_jdr_starter_contract.py` : passé
- `tests/test_v93_module_library_phase2_and_installer.py` : passé
- `tests/test_v94_branch_seam_and_installer.py` : passé

Limites explicitement non sur-affirmées :
- pas de claim d’un typecheck frontend global propre sur tout le repo
- pas de claim d’un `pytest` complet sur tout l’historique si des dépendances optionnelles externes manquent

---

## Dossier de doublons du patch

Un dossier dédié a été ajouté :
- `v95_jdr_patch_bundle/`

Il contient :
- `README.md`
- `MANIFEST.txt`
- `files/` avec les doublons des fichiers **source** ajoutés ou modifiés
- une copie de ce journal de version

But :
- faciliter la revue du patch
- isoler rapidement les fichiers impactés
- éviter d’avoir à reconstituer manuellement le diff à partir de tout le dépôt



## Hotfix v4.1 — GraphPayload edge validation fix

- Removed raw tool-origin edges from `artifact_registry/graphs/jdr_solo_session_starter.json`.
- Fixed `client/src/store.ts` export/build payload generation to exclude visual tool edges from API `edges`.
- Updated `tests/test_v95_jdr_starter_contract.py` to assert that starter artifact edges only reference real graph nodes and that export code filters non-API edges.
- User-facing symptom fixed: `GraphPayload` no longer raises `Edge source ... does not reference a known node` when building the JDR starter.


## Hotfix v4.2
- `client/src/store.ts`: prune stale tool edges and remove deleted tool IDs from `tools_linked` during node-removal changes.
- `artifact_registry/graphs/jdr_solo_session_starter.json`: rename visible dice tool label to `RPG Dice Roller`.


## Metadata/UI normalization hotfix (v4.5)

Final consistency pass applied to the JDR starter and guided builder.

Changes:
- normalized tool labels to a shared convention
- normalized internal tool descriptions to the same semantic pattern
- kept instance IDs and backend tool types unchanged from the v4.4 state
- synchronized the review bundle copies with the new metadata

Convention now used:
- `tool_rpg_dice_roller_1` → `RPG Dice Roller`
- `tool_sub_agent_cast_*` → `Cast Advisor · <Role>`
- `tool_llm_worker_rules_referee_1` → `Structured Rules Referee`

Impact:
- the starter JSON, guided builder, and review bundle now describe the same tools with the same language
- this reduces ambiguity during review and during guided cast switching


## Hotfix v4.6 — Prompt assignment ID sanitization
- sanitized `promptStripAssignments[].id` generation to satisfy backend GraphPayload validation
- removed colon-bearing assignment IDs from guided tabletop module assembly path
- updated JDR contract test coverage for assignment ID sanitization helpers


## v4.11 — JDR seam rework

- Reworked the guided JDR flow to derive catalog choices from module-library payloads when available.
- Replaced hardcoded cast-slot remapping with party-module subagent-group driven remapping.
- Reworked the structured rules referee helper to compose its system prompt from selected rules and tone modules.
- Updated the tabletop visual profile to derive labels from loaded module entries.
- Added starter references to all JDR modules so packs remain bounded and starter-linked.
