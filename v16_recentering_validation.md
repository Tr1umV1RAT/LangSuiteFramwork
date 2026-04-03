# v16 — Validation summary

## Validations exécutées

### Backend
```bash
python -m compileall api core db main.py
```
Résultat : OK

### Frontend
```bash
npm ci
npm run build
```
Résultat : OK

## Observations
- Build Vite réussi.
- Avertissement non bloquant sur la taille d'un chunk JS (>500 kB).
- Pas de QA navigateur manuelle effectuée dans cette passe.
