# Guide Utilisateur - LangSuiteLauncher avec JDR/Obsidian

## Démarrage via LangSuiteLauncher.pyw

Le launcher Tkinter est la méthode recommandée pour utiliser LangSuite avec l'architecture JDR modulaire.

### Lancement rapide

```bash
# Double-cliquez sur:
LangSuiteLauncher.pyw

# Ou depuis le terminal:
python LangSuiteLauncher.pyw
```

### Architecture des ports

| Service | Port | URL |
|---------|------|-----|
| Backend FastAPI | 8000 | http://127.0.0.1:8000 |
| Frontend Vite | 5000 | http://127.0.0.1:5000 |

### Fonctionnement

Le launcher démarre automatiquement :
1. **Backend** (FastAPI sur :8000) - API REST avec endpoints `/api/*`
2. **Frontend** (Vite dev server sur :5000) - UI React

L'UI s'ouvre automatiquement dans le navigateur par défaut.

---

## Utilisation de l'Export Obsidian MJ

### Depuis l'UI (Toolbar)

1. **Chargez ou créez un graph JDR**
   - Exemple: ouvrez le starter "Tabletop Solo Session Starter"
   - Ou créez votre propre session avec modules

2. **Dans la barre d'outils (Toolbar)**:
   - Cliquez sur **"Obsidian GM vault"** (bouton avec icône Link)
   - Ou via le menu: `Package → Export Obsidian GM vault`

3. **Téléchargement automatique**:
   - Le fichier `{graph_id}-obsidian-vault.zip` se télécharge
   - Exemple: `jdr_solo_session_starter-obsidian-vault.zip`

### Structure du vault exporté

Décompressez le zip dans votre dossier Obsidian vaults:

```
MonVault/
├── 00 Session Hub.md              ← Commencez ici
├── Dashboards/
│   ├── GM Dashboard.md            ← Vue MJ avec Dataview
│   ├── Session Dashboard.md       ← Suivi session active
│   └── Prep Dashboard.md          ← Préparation
├── Sessions/
│   ├── Current Session.md         ← Frame active
│   └── Session Log.md             ← Template log
├── Scenes/
│   ├── Current Scene.md           ← Scène active
│   ├── Scene Index.md             ← Index Dataview
│   └── opening_arrival - Roadside Arrival.md
├── Encounters/
│   ├── Encounter Index.md
│   └── opening_arrival - Roadside Arrival Encounter.md
├── Locations/
│   ├── Location Index.md
│   └── roadside_inn - Roadside Inn.md
├── Cast/
│   └── NPC Index.md               ← PNJ avec groupes
├── Modules/
│   └── Loaded Modules.md          ← Modules chargés
├── Prompts/
│   └── Active Prompt Strips.md    ← Prompts actifs
└── _langsuite/
    ├── export_manifest.json       ← Manifest technique
    └── graph_payload.json         ← Données complètes
```

### Prérequis plugins Obsidian

Pour utiliser les dashboards Dataview:

1. Installez le plugin **Dataview** (Community plugins)
2. Activez JavaScript queries dans les settings Dataview
3. Les dashboards du vault fonctionnent immédiatement

---

## Workflow MJ typique

### 1. Préparation (dans LangSuite)

```
LangSuiteLauncher.pyw → Tab "Tabletop" → Sélection modules:
  - Setting: Frontier fantasy
  - Rules: Light narrative  
  - Tone: Adventurous
  - Cast: Roadside cast
```

### 2. Export Obsidian

```
Toolbar → "Obsidian GM vault" → Décompresser dans vault Obsidian
```

### 3. Jouer (Obsidian)

```
Obsidian → Ouvrir vault "SessionJDR":
  1. Lire "00 Session Hub.md"
  2. Consulter "Dashboards/GM Dashboard" (vue d'ensemble)
  3. Suivre "Sessions/Current Session.md" pendant le jeu
  4. Noter dans "Sessions/Session Log.md"
```

### 4. Rétro-action

Après la session:
```
Obsidian → Modifier statuts → Re-exporter si besoin
```

---

## Modules JDR disponibles

### Via le Tabletop Starter Dialog

```
Ctrl+T (ou Tabletop menu) → "Guided Session Starter"
```

**Settings (Mondes)**:
- `frontier_fantasy` - Route, auberge, fantasy accessible
- `occult_city` - Indices, factions, danger caché
- `space_outpost` - Infrastructure, survie, mystère
- `ruined_coast` - Ports, épaves, ruines littorales
- `corporate_arcology` - Districts, surveillance, résistance

**Rules (Systèmes)**:
- `light_narrative` - Prompt-led, friction minimale
- `dice_forward` - Checks explicites, stakes définies
- `fiction_first_pressure` - Position avant jets
- `hard_choice_clocks` - Horloges visibles, tradeoffs

**Cast (Groupes PNJ)**:
- `roadside_cast` - Aubergiste, éclaireur, garde
- `investigator_contacts` - Faussaire, bibliothécaire, inspecteur
- `station_crew` - Quartier-maître, pilote, chef sécurité
- `relic_hunters` - Courtier, éclaireur, occultiste
- `response_team` - Médecin, ingénieur, marshal

---

## Architecture technique (rappel)

### Types modulaires JDR

```typescript
// SceneSeed - Scène structurée
SceneSeed {
  id: "opening_arrival"
  kind: "opening" | "travel" | "social" | "investigation" | "combat" | "fallback"
  status: "seeded" | "active" | "resolved"
  castGroupNames: ["roadside_cast"]
  encounterIds: ["opening_encounter"]
}

// ModuleLibraryEntry - Module avec dépendances
ModuleLibraryEntry {
  id: "module_jdr_adventure_demo"
  requiresSlots: ["opening_scene", "primary_cast"]
  providesSlots: [{
    slot: "opening_scene"
    entityType: "scene"
    entityId: "opening_arrival"
    policy: "exclusive" // | "append" | "replace"
  }]
  moduleDependencies: ["module_jdr_world_frontier"]
  moduleConflicts: ["module_jdr_world_occult_city"]
}
```

### API Endpoint Obsidian

```bash
POST /api/obsidian/vault
Content-Type: application/json

{
  "graph_id": "ma_session",
  "ui_context": { ... },
  "nodes": [...],
  "edges": [...], 
  "tools": [...]
}

# Retourne: ZIP binaire avec vault complet
```

---

## Dépannage

### Ports déjà utilisés

```bash
# Si 8000 ou 5000 sont occupés, modifiez via le launcher:
# Advanced → Backend port / Frontend port
```

### Build frontend échoue

```bash
# Réinstallez node_modules via le launcher:
# Settings → Check "Reinstall node modules"
# Ou manuellement:
cd client && npm install
```

### Export Obsidian échoue

Vérifiez:
1. Backend en cours d'exécution (port 8000)
2. Graph valide avec `runtimeSettings` 
3. Network tab (F12) → Requête `/api/obsidian/vault`

### Modules JDR manquants

```bash
# Vérifiez registration dans artifact_registry/graphs/jdr_solo_session_starter.json
python -c "from core.artifact_registry import get_artifact; print(get_artifact('graph', 'jdr_solo_session_starter'))"
```

---

## Résumé des commandes clés

```bash
# Lancement UI
python LangSuiteLauncher.pyw

# Tests JDR
python -m pytest tests/test_v95_jdr_*.py tests/test_v97_*.py tests/test_v98_*.py -v

# Build frontend (si besoin)
cd client && npm run build

# Démarrage backend uniquement
python main.py
```

L'architecture est **production-ready** et fonctionne entièrement via le launcher Tkinter.
