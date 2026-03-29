# CLAUDE.md — Duo Mode: Codex Lead + Claude Builder

## Projet
- Nom : test-autonomous (control plane dual-AI)
- Stack : Node.js ESM, zero deps, native http
- État : actif
- Objectif courant : améliorer les outils et skills pour tous les projets Robin

## Sources de vérité
1. Instruction de Robin (toujours prioritaire)
2. Ce fichier
3. Code existant + tests
4. Docs du repo

## Session start
Lance `/context` silencieusement. Résume en 2-3 lignes : tests, fichiers dirty, tâche en cours.

## Mode A — Assisté (défaut)
Robin pilote, tu exécutes intelligemment.

**Seuils :**
- 1-2 fichiers, scope clair → fais-le
- 3+ fichiers ou API/schema/modèle → propose l'approche en 3 lignes d'abord
- Nouvelle feature ou module → `/intake` avec Robin
- Idée incertaine → `/brainstorm` (utilise `codex exec --full-auto`)

**Tests :** `npm test` (node --test test/*.test.mjs)
- Logique métier → tests obligatoires
- Bug fix → test de non-régression
- Cosmétique → optionnel

**Stop si :** objectif ambigu, API publique changerait, tests cassent hors scope.

**Avant commit :** vérifie qualité, mets à jour TASKS.md si objectif complété.

## Mode B — Full autonome
Activé quand Robin donne un goal et dit de fonctionner en autonomie.

**Entrée obligatoire :** goal clair + définition de "terminé" + scope borné.

**Boucle :**
1. Codex planifie (`codex exec --full-auto`, inspecte le repo)
2. Claude exécute UNE tâche atomique
3. Tests après chaque modification
4. Codex review → approuvé/rejeté/bloqué
5. Tâche suivante ou stop

**Garde-fous :** pas de tâches hors goal, pas de refactor opportuniste, recheck `/context` toutes les 3 tâches, stop si dérive.

## Skills
- `/context` — reprendre un projet après absence
- `/brainstorm` — éprouver une idée avec Codex
- `/intake` — questionnaire pré-dev pré-rempli
- `/status` — dashboard rapide
- `/review-changes` — review avant commit

## Commandes
```bash
npm test           # node --test test/*.test.mjs
npm start          # node src/index.mjs
codex exec --full-auto "prompt"  # deuxième IA
```

## Structure
```
src/           — API + outils (ESM, zero deps)
src/v2/        — SwissBuildingOS V2
test/          — tests (node:test)
src/duo.mjs    — protocole Codex↔Claude
src/context.mjs — mémoire projet
```
