# Architecture d'intégration LangSuiteFramework ↔ Obsidian RPG/JDR

**Date:** 2026-04-04  
**Auteur:** Analyse Architecturale  
**Statut:** Exploration multi-options avant décision

---

## Executive Summary

Cette analyse explore **5 modèles d'architecture** pour l'intégration entre LangSuiteFramework (runtime/orchestration) et Obsidian (outil MJ/JDR), avec une comparaison rigoureuse des compromis et une recommandation de trajectoire progressive.

---

## A. Cartographie des Architectures Possibles

### Architecture 1: Export Unidirectionnel (Snapshot)
**Concept:** LangSuite reste la source unique de vérité. Obsidian reçoit des exports statiques.

```
LangSuiteFramework ──(export ZIP)──> Obsidian
        │                                   │
        ▼                                   ▼
   Source de vérité                   Lecteur seul
   Runtime active                     Archive/MJ prep
```

**Flux de données:**
1. Session active dans LangSuite
2. Export manuel ou automatique régulier
3. ZIP décompressé dans vault Obsidian
4. MJ lit, annoté, prépare mais ne pousse pas

**Implémentation actuelle:** ✅ Déjà partiellement en place (`core/obsidian_export.py`)

---

### Architecture 2: Sync Semi-Bidirectionnelle
**Concept:** LangSuite garde la vérité runtime, mais accepte des "recaps" structurés d'Obsidian.

```
LangSuiteFramework ⟷ Obsidian
        │                    │
        │──────Export───────>│
        │                    │
        │<─────Recap JSON────│ (contraint)
        │                    │
   Runtime master         Editable restreint
```

**Zones de flux retour contrôlé:**
- Session recap (résumé, décisions)
- Journal MJ (notes narratives)
- Statut validation (scènes résolues, clocks avancées)
- Factions/état monde (si module ad hoc)

---

### Architecture 3: Obsidian comme Cockpit MJ
**Concept:** LangSuite tourne headless/embedded ; Obsidian devient l'interface principale via Dataview + API.

```
┌─────────────────────────────────────┐
│         Obsidian (UI MJ)            │
│  Dashboards ── Dataview ── Boutons │
│        │                    │       │
│        ▼                    ▼       │
│  Vault local            API calls   │
└────────┬────────────────────┬────────┘
         │                    │
         │<─── Requêtes ─────>│
         │                    │
    ┌────┴────────────────────┴────┐
    │    LangSuiteFramework API        │
    │         (localhost:8000)        │
    └──────────────────────────────────┘
```

---

### Architecture 4: Plugin Obsidian Natif
**Concept:** Plugin Obsidian officiel qui lit directement les payloads LangSuite.

```
┌─────────────────────────────────────────┐
│   Obsidian avec Plugin LangSuite        │
│                                         │
│  ┌─────────────┐    ┌────────────────┐ │
│  │ Sidebar     │    │ Commands       │ │
│  │ - Scenes    │    │ - Refresh      │ │
│  │ - Cast      │    │ - Push note    │ │
│  │ - Clocks    │    │ - Next scene   │ │
│  └─────────────┘    └────────────────┘ │
│            │                            │
│            ▼                            │
│  ┌──────────────────────────────┐      │
│  │ Lit: workspaceState.json    │      │
│  │ Écrit: recap_*.json          │      │
│  └──────────────────────────────┘      │
└─────────────────────────────────────────┘
              │
              │ folder/file watch
              ▼
    ┌──────────────────────┐
    │ LangSuiteFramework     │
    │ (détecte changements)  │
    └────────────────────────┘
```

---

### Architecture 5: Approche Hybride (Recommandée)
**Concept:** Combine les forces de plusieurs approches par couches.

```
┌─────────────────────────────────────────────────────────────┐
│                         OBSIDIAN                             │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ Layer 1      │  │ Layer 2      │  │ Layer 3 (option)   │ │
│  │ Vault GM     │  │ Dataview     │  │ Companion script   │ │
│  │ statique     │  │ live         │  │ ou plugin léger    │ │
│  │              │  │              │  │                    │ │
│  │ - Scènes     │  │ - Active     │  │ - Refresh rapide   │ │
│  │ - PNJ        │  │ - À faire    │  │ - Quick actions    │ │
│  │ - Lieux      │  │ - Clocks     │  │ - Sync partielle   │ │
│  └──────────────┘  └──────────────┘  └────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              │ Export ZIP/Folder watch │
              │                         │
              ▼                         ▼
┌─────────────────────────┐    ┌────────────────────┐
│   LangSuiteFramework    │    │ API REST           │
│   Source de vérité      │    │ - GET /state       │
│   - Runtime             │    │ - POST /recap      │
│   - Modules             │    │ - POST /command    │
│   - Agents              │    │                    │
└─────────────────────────┘    └────────────────────┘
```

---

## B. Comparatif Détaillé

| Critère | Arch 1: Export | Arch 2: Sync | Arch 3: Cockpit | Arch 4: Plugin | Arch 5: Hybride |
|---------|----------------|--------------|------------------|----------------|------------------|
| **Source de vérité** | LangSuite | LangSuite | LangSuite | LangSuite | LangSuite |
| **Sens des flux** | Uni → | Bi (contrôlé) | Bi API | Bi natif | Multi-couches |
| **Complexité backend** | Faible | Moyenne | Moyenne | Faible | Moyenne |
| **Complexité frontend** | None | None | Élevée | Très élevée | Moyenne |
| **UX MJ** | Lecture | Lecture + push | Interactive | Native | Flexible |
| **Dépendances** | Aucune | File watch | API live | Plugin API | Sélective |
| **Coût maintenance** | Faible | Moyen | Élevé | Élevé | Maîtrisable |
| **Temps implémentation** | 0j (existe) | 3-5j | 2-3s | 2-3s | 2-4s |
| **Robustesse** | Élevée | Moyenne | Moyenne | Dépend Obsidian | Élevée |
| **Modularité JDR** | Oui | Oui | Oui | Oui | Excellente |

### Analyse approfondie par option

#### Option 1: Export Unidirectionnel

**Forces:**
- Simplicité maximal (KISS)
- Aucune dépendance runtime
- Fonctionne offline dans Obsidian
- Pas de conflits de synchronisation
- Maintenance quasi-nulle

**Faiblesses:**
- Friction d'export manuel
- Pas de "live view" de la session
- MJ doit basculer entre deux apps
- Pas de feedback depuis Obsidian vers LangSuite

**Quand l'utiliser:**
- Phase MVP
- Playtests initiaux
- Groupes avec workflow prépa/lecture
- Quand la stabilité prime sur la fluidité

**Coût:** 0j (existe déjà)

---

#### Option 2: Sync Semi-Bidirectionnelle

**Forces:**
- Garde le contrôle LangSuite
- Permet archivage session enrichi
- Structure de "recap" validable

**Faiblesses:**
- Complexité merge/scoping
- Risque de conflits si mal géré
- Nécessite définition stricte des champs synchronisés

**Quand l'utiliser:**
- Quand MJ veut prendre des notes qui enrichissent LangSuite
- Archivage long terme
- Mode "campagne" avec persistance multi-sessions

**Coût:** 3-5j pour mécanisme recap robuste

**Risques techniques:**
- File locking/last-write-wins
- Schéma validation Pydantic côté retour
- Merge policies pour modules

---

#### Option 3: Cockpit MJ (Obsidian-centric)

**Forces:**
- Ergonomie maximale pour MJ
- Dashboards Dataview très puissants
- Tout dans un même outil (Obsidian)

**Faiblesses:**
- Couplage fort Obsidian↔LangSuite
- Si l'API ne répond pas, cockpit inutilisable
- Nécessite Obsidian ouvert + LangSuite ouvert
- Complexité API temps réel

**Quand l'utiliser:**
- MJ expérimenté avec Obsidian
- Sessions longues en ligne
- Besoin de vue temps réel

**Coût:** 2-3s dev (API + templates Dataview)

**Risques:**
- Latence requêtes HTTP
- Gestion erreurs réseau
- CORS/localhost portability

---

#### Option 4: Plugin Obsidian Natif

**Forces:**
- Intégration native optimale
- UX "produit fini"
- Potentiel marketplace Obsidian

**Faiblesses:**
- Très coûteux en dev (TypeScript Obsidian API)
- Maintenance liée à l'évolution Obsidian
- Courbe d'apprentissage API spécifique
- Over-engineering pour usage interne

**Quand l'utiliser:**
- Produit grand public
- Distribution externe
- Ressources dev dédiées

**Coût:** 2-3s (dev plugin Obsidian)

**Risques:**
- Breaking changes API Obsidian
- Support multi-version Obsidian
- Review process marketplace

---

#### Option 5: Hybride (Recommandée)

**Forces:**
- Évolutivité par couches
- Couche 1 fonctionne immédiatement
- Couche 2 ajoute de la valeur
- Couche 3 optionnelle
- Modularité: utilise ce dont tu as besoin

**Faiblesses:**
- Plus complexe à expliquer
- Plusieurs composants à maintenir
- Risque de duplication logique

**Quand l'utiliser:**
- Démarrage rapide + évolutivité
- Besoin réel de "live"
- Modularité JDR complexe

**Coût:** 2-4s par phases incrémentales

---

## C. Recommandation Stratégique

### Trajectoire en phases

```
Temps -->

Phase 1: Export GM Vault (maintenant)
├─ Export ZIP unidirectionnel
├─ Dashboards Dataview statiques
├─ Friction acceptable pour validation
└─ Déjà implémenté à 80%

Phase 2: Fondation JDR Structurée (semaines 1-2)
├─ SceneSeed, EncounterSeed, LocationSeed enrichis
├─ Clock system
├─ Factions & hooks
├─ Module library phase 3
└─ Export automatique des changements runtime

Phase 3: Sync Ciblée (semaines 3-4)
├─ POST /api/session/recap
├─ Session log validation
├─ Import Obsidian → LangSuite (contraint)
├─ Conflict resolution policies
└─ Module state merge

Phase 4: Cockpit Avancé (option, mois 2)
├─ WebSocket temps réel
├─ Dataview live connectés à l'API
├─ Actions rapide depuis Obsidian
└─ Companion script ou plugin léger

Phase 5: Polish & Distribution (option)
├─ Plugin Obsidian marketplace (si publique)
├─ Sync cloud
├─ Multi-device
└─ Analytics?
```

### Pourquoi cette trajectoire?

1. **Valeur immédiate:** L'export existe, ça marche maintenant
2. **Validation progressive:** Chaque phase valide la précédente
3. **Coût maîtrisé:** On ne sur-ingenie pas avant d'avoir validé l'usage
4. **Flexibilité:** Chaque phase est optionnelle si la précédente suffit
5. **Risque décroissant:** Plus on avance, plus on sait ce dont on a vraiment besoin

---

## D. Design Concret pour le Dépôt Actuel

### Fichiers concernés par phase

#### Phase 1 (Existant - à consolider)

| Fichier | Action | Notes |
|---------|--------|-------|
| `core/obsidian_export.py` | ✅ Stabiliser | Nettoyer, documenter, tests |
| `api/obsidian.py` | ✅ Valider | Endpoint POST /vault |
| `client/src/components/Toolbar.tsx` | ✅ OK | Bouton export |
| `client/src/components/ObsidianGraphPanel.tsx` | 🔄 Enrichir | Vue graphe liens |
| `client/src/jdr/obsidianGraph.ts` | 🔄 Compléter | Noirs cast/scene/prompts |

#### Phase 2 (Entités JDR enrichies)

| Fichier | Action | Contenu |
|---------|--------|---------|
| `core/schemas.py` | 🆕 Ajouter | ClockSeed, FactionSeed, HookSeed |
| `client/src/store/types.ts` | 🔄 Aligner | Types TypeScript miroir |
| `core/obsidian_export.py` | 🔄 Étendre | Render des nouveaux seeds |
| `artifact_registry/graphs/` | 🆕 Enrichir | Modules clocks, factions, hooks |
| `templates/obsidian/clocks.md.jinja` | 🆕 Créer | Template horloges |
| `templates/obsidian/factions.md.jinja` | 🆕 Créer | Template factions |

#### Phase 3 (Sync bidirectionnelle)

| Fichier | Action | Contenu |
|---------|--------|---------|
| `api/obsidian.py` | 🆕 Ajouter | POST /recap, POST /sync_state |
| `core/recap_processor.py` | 🆕 Créer | Validation Pydantic retour |
| `core/session_memory.py` | 🆕 Créer | Persistance session logs |
| `client/src/store/workspace.ts` | 🔄 Étendre | Fonctions merge recap |
| `tests/test_obsidian_sync_*.py` | 🆕 Créer | Tests flux bidirectionnels |

#### Phase 4 (Cockpit temps réel)

| Fichier | Action | Contenu |
|---------|--------|---------|
| `api/realtime.py` | 🆕 Créer | WebSocket ou SSE |
| `client/src/store/syncBridge.ts` | 🆕 Créer | Abonnement temps réel |
| `obsidian-companion/` | 🆕 Créer | Script Python côté vault |
| `obsidian-companion/refresh.py` | 🆕 Créer | Watcher + API calls |

---

### Architecture technique Phase 2 (prochaine étape suggérée)

```python
# core/schemas.py - Extensions suggérées

class FactionSeed(StructuredSeedBase):
    """Faction du monde avec présence, agenda, ressources."""
    tier: str  # "local", "regional", "global"
    type: str  # "political", "criminal", "economic", "mystical", "military"
    presence: dict[str, str]  # location_id -> "strong|weak|hidden"
    agenda: str
    resources: list[str]
    rivals: list[str]  # faction_ids
    allies: list[str]  # faction_ids
    clocks: list[str]  # clock_ids liés

class HookSeed(StructuredSeedBase):
    """Crochet narratif à intégrer."""
    hook_type: str  # "rumor", "event", "discovery", "threat", "opportunity"
    trigger_condition: str
    content: str
    target_scene_ids: list[str]
    target_location_ids: list[str]
    expiration: Optional[str]  # clock_id ou ""

class ClockSeed(StructuredSeedBase):
    # Existant mais enrichi:
    linked_faction_ids: list[str]
    linked_scene_ids: list[str]
    linked_encounter_ids: list[str]
    public: bool = False  # visible aux joueurs?    
```

---

## E. Implémentation Proposée

### Choix principal: Phase 2 enrichie (Entités JDR complètes)

Je recommande d'implémenter **l'enrichissement des seeds JDR** avant de faire de la sync bidirectionnelle, car:

1. Ça maximise la valeur de l'export Phase 1
2. Ça structure vraiment le contenu JDR
3. Ça prépare le terrain pour la sync Phase 3
4. C'est réalisable en 1 semaine

### Implémentation immédiate suggérée

#### Étape 1: Enrichir les types (core/schemas.py)

Ajouter `FactionSeed`, `HookSeed` avec validation Pydantic v2 stricte.

#### Étape 2: Enrichir l'export Obsidian

Templates markdown pour:
- **Horloges** avec visualisation segments
- **Factions** avec relations
- **Hooks** avec statut actif/inactif/épuisé
- **Dashboard Factions** (Dataview)

#### Étape 3: Enrichir ModuleLibraryEntry

```python
class ModuleLibraryEntry(BaseModel):
    # Existant:
    sceneSeeds, encounterSeeds, locationSeeds, clockSeeds
    # Nouveau:
    factionSeeds: list[FactionSeed]
    hookSeeds: list[HookSeed]
    # Aussi: worldSeeds? rulesSeeds? (peut-être overkill)
```

#### Étape 4: Frontend - ObsidianGraphPanel

Ajouter visualisation:
- Noirs de clocks
- Noirs de factions
- Liens (edges) entre entités liées

### Variante secondaire: Sync Session Recap (Phase 3 lite)

En parallèle, préparer:
- Structure JSON de recap
- Endpoint API /recap
- Module de validation

Sans l'activer immédiatement dans l'UI, mais prêt pour les tests manuels.

---

## Analyse des zones fragiles

### Zone à risque: Merge policies

Le merge de modules est déjà complexe avec `error/preserve/replace`. Ajouter la sync depuis Obsidian crée un **troisième acteur** dans les merges.

**Mitigation:**
- Garder LangSuite master pour tout ce qui est runtime
- Obsidian ne pousse que des "propositions"
- Validation explicite avant merge
- UI LangSuite pour "approuver/refuser" les recaps

### Zone à risque: File system sync

Si on fait du folder watch pour la sync, risque de:
- Files half-written
- Conflicts multi-editor
- Permissions

**Mitigation:**
- Atomic writes (temp + rename)
- File locking ou timestamps
- Debouncing

### Zone à risque: Couplage Obsidian

Si on développe trop de features Obsidian-specific, on devient dépendant de:
- Syntaxe Dataview (plugin tiers)
- API Obsidian (pour plugin natif)
- Format vault

**Mitigation:**
- Standard Markdown + YAML frontmatter (portable)
- Dataview comme enhancement progressive (dégradable)
- Pas de plugin natif sauf Phase 5 optionnelle

---

## Synthèse décisionnelle

| Question | Réponse recommandée |
|----------|---------------------|
| Par où commencer? | Phase 2: Enrichir seeds JDR |
| Implémente-t-on déjà la sync? | Préparer l'API, pas l'UI |
| Plugin Obsidian natif? | Non, sauf usage externe |
| Cockpit temps réel? | Phase 4 si besoin identifié |
| Priorité feature? | Horloges visuelles + Factions |

---

## Prochaines actions concrètes

1. **✅ Immédiat:** Valider que l'export actuel suffit pour usage MJ basique
2. **📝 Cette semaine:** Implémenter `FactionSeed`, `HookSeed`, enrichir `ClockSeed`
3. **📝 Cette semaine:** Templates markdown pour nouvelles entités
4. **📝 Semaine suivante:** Enrichir `ObsidianGraphPanel` avec visualisation entités
5. **📋 À préparer:** Schéma JSON recap pour Phase 3
6. **📋 À décider:** Quand basculer en Phase 3 (dépend usage réel)

---

**Conclusion:** L'architecture hybride par phases offre le meilleur rapport valeur/risque. Commençons par consolider Phase 1 et enrichir Phase 2 avant de se lancer dans des sync complexes.
