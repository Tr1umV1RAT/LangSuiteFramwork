# LangSuite — résumé des passes récentes intégrées

Ce résumé décrit l'état **intégré** du repo courant, pour éviter de reconstituer l'historique à partir de multiples patchs isolés.

## 1. Vérité de persistance projet
- clarification de ce que `save/open` projet préserve réellement
- distinction plus nette avec package import/export et compile

## 2. Consolidation des blocs de vérité
- mutualisation d'une partie des blocs UI de vérité de persistance
- réduction de la dérive de wording entre surfaces

## 3. Dé-emphase des rails avancés
- LangGraph reste le chemin de premier succès
- LangChain / DeepAgents restent accessibles mais ne sont plus poussés comme chemins pairs par défaut

## 4. Consolidation des badges de vérité de surface
- composant partagé pour certains badges compile/runtime/editor-first
- réduction du markup inline répété

## 5. Exposition LangChain bornée
- exposition de surfaces bridge-ready à l'intérieur du chemin LangGraph
- aucune prétention de parité runtime standalone pour LangChain

## 6. Vérité runner-busy / concurrence
- clarification UI que la limite porte sur plusieurs sessions Run partageant un même backend process
- pas une limitation des branches async internes à un graphe unique

## 7. Clarification mémoire / RAG
- séparation plus visible entre :
  - checkpoint / thread state
  - runtime store
  - local RAG / embeddings retrieval

## 8. Ordonnancement mémoire de premier succès
- surfaces canoniques mémoire mises plus tôt
- helpers legacy gardés mais moins dominants
- introduction d'un modèle de lanes mémoire côté frontend

## 9. Direction suivante
Le prochain plan mémoire recommandé dans le repo n'est plus une simple clarification d'exécution.
C'est un plan documentaire/épistémique avec :
- document brut
- document structuré
- evidence / claim
- statut épistémique
- lignée de promotion
