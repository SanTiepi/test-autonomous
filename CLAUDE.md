# CLAUDE.md — Duo Mode: Codex Lead + Claude Builder

## 1. Sources de vérité (par priorité)
1. Demande explicite de Robin
2. Ce fichier
3. Code existant + tests
4. Conventions du repo / docs locales

## 2. Session start
Lance `/context` silencieusement. Puis dis en 2-3 lignes : état des tests, fichiers dirty, tâche en cours. Si Robin donne une instruction, elle prime sur la tâche active de TASKS.md.

## 3. Règles d'exécution

**Avant de coder :** comprendre le contexte, identifier les impacts, choisir le plus petit changement correct.

**Seuils concrets :**
- 1-2 fichiers, pas de changement d'API publique → fais-le directement
- 3+ fichiers, ou touche un schema/modèle/API publique → `/brainstorm` avec Codex avant
- Nouvelle feature, nouveau module, changement de DB → `/intake` d'abord

**Tests :**
- Logique métier change → tests obligatoires
- Bug fix → test de non-régression obligatoire
- Changement cosmétique → tests optionnels
- Toujours lancer les tests impactés après modification

**Stop et demande si :**
- L'objectif est ambigu
- Un contrat d'API public changerait
- Des tests cassent sans rapport avec la tâche
- Le scope dépasse ce qui était prévu

## 4. Duo protocol

Codex (planificateur/reviewer) communique via `codex exec --full-auto` ou API.

```
Plan:  FIX/FEAT/REFACTOR: ... | FILES: ... | DO: ... | TEST: ... | DONT: ...
Report: DONE: ... | CHANGED: ... | TESTS: x/x | RISK: ...
Review: VERDICT: approve/challenge/reject | REASON: ... | FIX: ...
```

## 5. Skills — quand les utiliser

- `/context` — début de session (automatique), ou retour sur un projet après absence
- `/brainstorm` — quand >1 approche crédible, ou risque élevé, ou idée nouvelle
- `/intake` — avant une feature : génère les décisions pré-remplies, Robin valide
- `/status` — check rapide pendant le travail
- `/review-changes` — avant commit
- `/test-gap-hunt` — audit couverture tests
- `/health-check` — après changements majeurs

## 6. Outils

Bash UNIQUEMENT pour : `npm test`, `git`, `node`, `codex exec`.
Pour tout le reste : Read, Edit, Write, Grep, Glob.

## 7. Structure du repo

```
src/           — API source + outils (Node.js ESM, zero deps)
src/v2/        — SwissBuildingOS V2
test/          — tests (node:test)
src/duo.mjs    — protocole Codex↔Claude
src/context.mjs — mémoire projet + retrieval
src/engine.mjs — moteur autonome
```

## 8. Commandes

```bash
npm test           # node --test test/*.test.mjs
npm start          # node src/index.mjs
```
