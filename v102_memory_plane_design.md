# LangSuite — v102 Memory Plane Design

## Statut
Brouillon de conception aligné sur l'état **réel** actuel du repo après les passes de clarification mémoire/RAG.

Ce document ne prétend pas que LangSuite possède déjà un hub mémoire complet au sens d'une architecture multi-plans exhaustive.
Il fixe plutôt le **prochain plan mémoire** à construire **au-delà de la mémoire d'exécution** déjà présente dans le produit.

---

## 1. Point de départ : ce que LangSuite a réellement aujourd'hui

LangSuite dispose déjà d'un noyau de **mémoire d'exécution** composé de quatre familles proches mais non équivalentes :

1. **Checkpoint / thread state**
   - continuité de thread
   - snapshots de super-step
   - pause/reprise
   - portée graphe

2. **Runtime store**
   - lecture/écriture/recherche bornées
   - mémoire clé/valeur ou store structuré de runtime
   - surfaces principales : `memory_access`, `store_put`, `store_get`, `store_search`

3. **Local RAG / embeddings retrieval**
   - récupération dans un index vectoriel local
   - dépend d'un modèle d'embedding et d'un index persistant
   - surface principale : `rag_retriever_local`

4. **Contexte proche de runtime**
   - trimming, projections, payloads, résultats intermédiaires
   - utile pour l'exécution mais non équivalent à une mémoire stable de preuve ou de dossier

### Conséquence
Le repo a déjà raison sur un point fondamental :

> checkpointing != runtime store != vector retrieval

Mais LangSuite ne possède pas encore une vraie couche au-dessus pour gérer proprement :
- les documents,
- les preuves,
- les claims,
- le statut épistémique,
- la lignée de promotion.

---

## 2. Le prochain plan mémoire à ajouter

Le prochain plan ne doit **pas** être un simple ajout de nœuds mémoire.

Le prochain plan doit être un **plan de mémoire documentaire et épistémique**.

Sa fonction n'est pas d'améliorer la continuité d'exécution.
Sa fonction est de rendre possible :
- l'ingestion de matériau source,
- sa structuration,
- sa mobilisation comme support,
- la séparation entre assertion et support,
- la qualification épistémique,
- et la traçabilité des promotions.

En termes LangSuite, cela revient à ajouter un plan intermédiaire entre :
- les artefacts / graphes / runtime,
- et les surfaces futures de raisonnement, revue, analyse, ou décision assistée.

---

## 3. Sous-plans à introduire

### 3.1 Mémoire documentaire brute

#### Rôle
Conserver les sources importées sans les confondre avec des preuves ou du contexte runtime.

#### Objets cibles
- `document_raw`
- `document_source`
- `document_import`

#### Contenu
- PDF
- markdown
- texte
- HTML
- exports bruts
- logs importés
- éventuellement images / pièces jointes plus tard

#### Invariants
- provenance obligatoire
- hash ou fingerprint souhaitable
- aucune transformation destructive silencieuse
- ne jamais traiter le document brut comme une preuve juste parce qu'il est stocké

#### Place dans LangSuite
Ce plan est plus proche :
- d'un registre documentaire,
- d'un store d'ingestion,
- ou d'une bibliothèque source,
que du runtime store.

Il doit donc rester **distinct** de `memory_access` / `store_put`.

---

### 3.2 Mémoire documentaire structurée

#### Rôle
Projeter le brut en segments, chunks, sections, tables ou métadonnées exploitables pour retrieval et extraction.

#### Objets cibles
- `document_structured`
- `document_chunk`
- `document_section`
- `document_table_extract`

#### Fonction
- chunking
- offsets / positions
- index lexical
- index vectoriel si nécessaire
- métadonnées documentaires
- segmentation logique

#### Invariants
- lien obligatoire vers le document brut
- conserver contexte / offsets
- ne jamais promouvoir automatiquement un chunk en preuve

#### Lien avec embeddings
Le vector store n'est qu'un **mécanisme d'accès** à cette mémoire structurée.
Il ne doit pas devenir le nom de la mémoire elle-même.

Autrement dit :
- embeddings = substrate possible
- documentaire structuré = plan mémoire

---

### 3.3 Séparation `Evidence` / `Claim`

#### Problème actuel
Le repo sait récupérer et manipuler de l'information, mais ne formalise pas encore fortement la différence entre :
- ce qui **supporte** une assertion,
- et l'assertion elle-même.

#### Plan cible
Ajouter deux objets explicites :

##### `Evidence`
Support qualifié, avec provenance.

Champs minimaux souhaitables :
- `id`
- `source_ref`
- `excerpt_ref` ou `chunk_ref`
- `document_ref`
- `content`
- `epistemic_status`
- `created_at`
- `producer_ref`

##### `Claim`
Assertion formulée ou candidate.

Champs minimaux souhaitables :
- `id`
- `content`
- `scope`
- `created_at`
- `producer_ref`
- `epistemic_status`
- `support_refs[]`

#### Règle stricte
- un hit de retrieval != une evidence
- une evidence != un claim
- un claim != une décision

#### Effet produit
Cela prépare :
- la revue critique,
- le raisonnement contradictoire,
- l'audit,
- les futures surfaces de synthesis / review.

---

### 3.4 Plomberie du statut épistémique

#### Pourquoi c'est nécessaire
LangSuite a commencé à raisonner en termes de vérité produit / runtime / support.
Mais il manque encore un statut uniforme appliqué aux objets mémoire non-exécution.

#### Enum minimale recommandée
- `raw`
- `extracted`
- `inferred`
- `hypothesis`
- `corroborated`
- `contradicted`
- `human_validated`
- `rejected`
- `unknown`

#### Usage
- `document_raw` commence en `raw`
- `document_chunk` ou extraction commence en `extracted`
- un claim généré par transformation commence souvent en `inferred` ou `hypothesis`
- une evidence peut devenir `corroborated`
- une validation humaine passe par `human_validated`

#### Règle de design
Le statut doit être :
- visible,
- transportable,
- loggable,
- et historié.

Il ne doit pas être implicite dans du texte libre.

---

### 3.5 Lignée de promotion

#### But
Empêcher les glissements silencieux de nature.

#### Problème visé
Aujourd'hui, dans beaucoup de systèmes, un extrait, une synthèse, un résultat de retrieval, une assertion ou un rapport peuvent se transformer en “vérité” sans trace claire.

#### Opérations à expliciter
Exemples d'opérations nommées :
- `promote_document_chunk_to_evidence_candidate`
- `approve_evidence_candidate`
- `promote_claim_to_corroborated`
- `promote_notes_to_artifact`
- `archive_epistemic_branch`

#### Modèle minimal
Créer un journal append-only de promotions :
- `promotion_id`
- `source_object_ref`
- `target_object_ref`
- `operation`
- `actor_ref`
- `justification`
- `created_at`

#### Règle stricte
Aucun objet ne change de nature sans :
- opération nommée,
- trace,
- acteur,
- justification minimale.

---

## 4. Comment cela s'articule avec LangSuite

## 4.1 Ce qui doit rester dans la mémoire d'exécution
Doivent rester dans la couche actuelle :
- checkpointing
- runtime store
- local RAG comme retrieval runtime
- contexte de run / projections / payloads

## 4.2 Ce qui doit vivre dans le prochain plan
Doivent entrer dans le prochain plan :
- documents bruts
- documents structurés
- evidence
- claim
- épistémique
- promotions

## 4.3 Ce qui doit venir encore après
Seulement ensuite :
- hypothèses comme branches dédiées
- décisions
- policies de promotion plus fortes
- archive froide
- données d'apprentissage curated

---

## 5. Recommandation d'implémentation réaliste

### Phase A — formaliser le vocabulaire sans mentir
Objectif : introduire les concepts dans le repo sans prétendre qu'ils sont déjà pleinement exécutables.

Actions possibles :
- capability metadata prudente
- docs et labels internes
- mapping clair entre mémoire d'exécution et futur plan documentaire/épistémique

### Phase B — introduire les types primitifs
Objectif : rendre les objets explicitement représentables.

Cibles minimales :
- `DocumentRecord`
- `EvidenceRecord`
- `ClaimRecord`
- `PromotionRecord`

Code probable :
- `core/schemas.py`
- surfaces API dédiées
- stockage DB minimal

### Phase C — connecter le retrieval documentaire aux objets
Objectif : faire en sorte que le retrieval rende des objets documentaires et non seulement du texte.

Cibles :
- `document_chunk` avec provenance
- `evidence_candidate`
- `claim_candidate` éventuellement plus tard

### Phase D — exposer l'épistémique et la promotion
Objectif : donner une vraie lisibilité produit aux transformations.

UI possibles :
- badges de statut
- panneau “promotion lineage”
- evidence/claim links

---

## 6. Système d'embeddings : position de conception

### Ce qu'il faut éviter
- appeler “mémoire” ce qui n'est qu'un index vectoriel
- confondre embedding store et vérité documentaire
- faire des hits vectoriels une preuve implicite

### Ce qu'il faut faire
- traiter les embeddings comme un **substrat de retrieval**
- rattacher les résultats à des objets documentaires structurés
- pouvoir promouvoir un extrait en evidence candidate avec provenance
- conserver la séparation retrieval / preuve / claim

### Doctrine courte
> Les embeddings servent à retrouver. Ils ne servent ni à prouver, ni à décider, ni à qualifier seuls le statut épistémique.

---

## 7. Anti-patterns à éviter dans LangSuite

1. Étendre `memory_access` jusqu'à absorber documents, preuves et claims.
2. Présenter `rag_retriever_local` comme mémoire universelle.
3. Introduire un “knowledge node” fourre-tout sans statuts ni provenance.
4. Permettre des promotions implicites depuis du retrieval ou des artefacts.
5. Confondre persistence d'exécution et mémoire probatoire.

---

## 8. Conclusion

Le prochain progrès sérieux de LangSuite sur la mémoire n'est pas :
- plus de CRUD,
- plus d'helpers,
- plus de synonymes UI.

Le prochain progrès sérieux est l'introduction d'un **plan documentaire et épistémique explicite** au-dessus de la mémoire d'exécution.

En formule courte :

> LangSuite doit passer de “execution memory clarified” à “documented knowledge lineage”.

Cela signifie, dans l'ordre :
1. `document_raw`
2. `document_structured`
3. `evidence` / `claim`
4. `epistemic_status`
5. `promotion_lineage`

Sans cela, la suite mémoire restera propre au niveau runtime, mais incomplète au niveau connaissance, justification et audit.
