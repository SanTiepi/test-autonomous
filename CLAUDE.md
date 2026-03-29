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

## RÈGLES DURES — Codex (non négociable)

Ces règles ne sont PAS optionnelles. Tu ne les ignores JAMAIS "parce que c'est plus rapide".

### Brainstorm
- Mode Quick → tu fais seul, OK
- Mode Standard/Deep/Explore → tu DOIS appeler `codex exec --full-auto` avec le sujet. Pas optionnel. Lance-le en background si tu veux continuer pendant qu'il réfléchit. Quand il répond, compare avec ton analyse. Les DIVERGENCES sont les insights les plus précieux.

### Développement
- Quand tu codes 3+ fichiers → lance Codex en background pour écrire les tests OU review le plan :
  `codex exec --full-auto -s workspace-write "Écris les tests pour [module]. Contrats: [signatures]." &`
- Après chaque phase majeure (3+ fichiers modifiés) → Codex review OBLIGATOIRE :
  `codex exec --full-auto "Review les changements récents dans src/. Vérifie cohérence, edge cases, bugs. Verdict: approve/fix."`
- Si tu hésites sur une décision d'architecture → Codex tranche, pas toi :
  `codex exec --full-auto "Décision: [A ou B]. Contexte: [contexte]. Tranche."`

### Parallélisme
- Utilise tes Agent Teams / subagents pour les tâches parallélisables
- Lance Codex en background (`&`) pendant que tu codes — ne l'attends PAS
- Tu dois avoir 2-3 choses qui tournent en même temps quand le projet le permet

### Ce que Codex fait MIEUX que toi
- Review externe (il n'a pas tes biais de créateur)
- Décisions d'architecture (il est plus brutal et direct)
- Challenge des hypothèses (il ne te confirme pas par politesse)
- Estimation d'effort (il connaît les patterns de l'industrie)

### Ce que tu fais MIEUX que Codex
- Code complexe et itératif
- Fix-loop (diagnostic + correction rapide)
- Intégration de modules entre eux
- Connaissance profonde du repo en cours

## Mode A — Assisté (défaut)
Robin pilote, tu exécutes. Flow automatique :

```
Instruction de Robin
  → si idée floue/risquée → /brainstorm (avec Codex obligatoire si Standard+)
  → si feature complexe → /intake
  → code (lance Codex en background pour tests ou review si 3+ fichiers)
  → tests ciblés automatiques
  → si fail → /fix-loop (max 3 tours)
  → si verts → review (Codex si changement majeur, mental sinon)
  → commit
```

**Seuils :**
- 1-2 fichiers, scope clair → fais-le, Codex pas nécessaire
- 3+ fichiers ou API/schema → Codex review obligatoire
- Nouvelle feature ou module → `/intake` + Codex tests en background
- Idée incertaine → `/brainstorm` Standard ou Deep (Codex obligatoire)

**Tests :** `npm test`
- Après chaque modification → tests ciblés
- Si fail → `/fix-loop`
- Logique métier → tests obligatoires

**Stop si :** objectif ambigu, API publique changerait, tests cassent hors scope.

## Mode B — Full autonome

**Entrée obligatoire :** goal clair + "terminé" défini + scope borné.

**Boucle :**
```
/context
Codex planifie (codex exec --full-auto, inspecte le repo)
  → Claude exécute (Mode A)
  → Codex review → approuvé/rejeté/bloqué
  → Tâche suivante ou stop
Recheck /context toutes les 3 tâches
```

**Garde-fous :** pas de tâches hors goal, pas de refactor opportuniste, stop si dérive.

## Skills
- `/context` — reprendre un projet
- `/brainstorm` — éprouver une idée (Quick=seul, Standard+=Codex obligatoire)
- `/intake` — questionnaire pré-dev pré-rempli
- `/status` — dashboard rapide
- `/genesis` — de l'idée au repo complet
- `/portfolio` — vue multi-projets
- `/fix-loop` — boucle test/fix auto

## Commandes
```bash
npm test
npm start
codex exec --full-auto "prompt"
codex exec --full-auto -s workspace-write "prompt" &  # background
```

## Structure
```
src/           — API + outils (ESM, zero deps)
src/v2/        — SwissBuildingOS V2
test/          — tests (node:test)
src/duo.mjs    — protocole Codex↔Claude
src/context.mjs — mémoire projet
docs/          — vision, plans, status
```
