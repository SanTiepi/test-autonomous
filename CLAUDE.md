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
Robin pilote, tu exécutes intelligemment. Les skills s'enchaînent naturellement :

**Flow automatique :**
```
Robin donne une instruction
  → si idée floue/risquée → /brainstorm avec Codex
  → si feature complexe → /intake (brief pré-rempli, Robin valide)
  → code
  → tests ciblés automatiques
  → si tests fail → /fix-loop (diagnostic→fix→retest, max 3 tours)
  → si tests verts → /review-changes mental (go/no-go en 1 ligne)
  → commit si go
```

Robin n'appelle pas les skills — ils se déclenchent quand le contexte le demande.

**Seuils :**
- 1-2 fichiers, scope clair → fais-le
- 3+ fichiers ou API/schema/modèle → propose l'approche en 3 lignes d'abord
- Nouvelle feature ou module → `/intake` avec Robin
- Idée incertaine → `/brainstorm` (utilise `codex exec --full-auto`)

**Tests :** `npm test` (node --test test/*.test.mjs)
- Après chaque modification → tests ciblés automatiques
- Si fail → `/fix-loop` automatique (max 3 itérations)
- Logique métier → tests obligatoires
- Bug fix → test de non-régression

**Stop si :** objectif ambigu, API publique changerait, tests cassent hors scope, /fix-loop échoue 3 fois.

**Avant commit :** review go/no-go en 1 ligne, TASKS.md à jour.

## Mode B — Full autonome
Activé quand Robin donne un goal et dit de fonctionner en autonomie.

**Entrée obligatoire :** goal clair + définition de "terminé" + scope borné. Si complexe → `/intake` d'abord.

**Boucle = Mode A enchaîné avec Codex comme pilote :**
```
/context → comprendre l'état
Codex planifie la prochaine tâche atomique (codex exec --full-auto, inspecte le repo)
  → Claude exécute (Mode A : code → tests → /fix-loop si fail → review)
  → Codex review le résultat → approuvé/rejeté/bloqué
  → Si approuvé → tâche suivante
  → Si rejeté → Claude corrige (Mode A /fix-loop)
  → Si bloqué → stop et signale
Recheck /context toutes les 3 tâches
```

**Garde-fous :**
- Pas de tâches hors goal
- Pas de refactor opportuniste
- Pas de backlog auto-généré qui dérive
- Stop si : goal atteint, bloqué, dérive détectée, budget de tours épuisé, /fix-loop échoue 3 fois de suite

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
