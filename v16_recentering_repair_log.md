# v16 — Repair log

## Changements appliqués

1. Ajout `EditorMode` dans le store (`simple` / `advanced`)
2. Persistance du mode éditeur dans `localStorage`
3. Ajout du toggle “Graph simple / Suite” dans la toolbar
4. Remappage des labels du système de panneaux latéraux selon le mode
5. Réécriture de `BlocksPanelContent`
6. Refonte du rendu du `StatePanelContent`
7. Simplification conditionnelle de `CustomNode`
8. Réécriture du `RunPanel`
9. Correction des types de logs runtime côté frontend (`started`, `completed`, `paused`, `node`)

## Notes
- Aucun changement runtime backend structurel
- Aucun changement de contrat API nécessaire pour cette passe
