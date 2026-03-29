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

## Codex — quand l'utiliser (et quand NE PAS)

Codex (`codex exec --full-auto`) est un deuxième cerveau avec des biais différents. Il apporte de la valeur quand tu as besoin d'un REGARD EXTÉRIEUR. Pas pour tout.

**UTILISE Codex quand :**
- Brainstorm mode Explore — obligatoire, c'est là que les divergences créent de la valeur
- Décision d'architecture structurante — quand 2 approches se valent
- Tu es bloqué — un regard frais débloque
- Review d'un changement risqué — avant de merger du coeur système

**N'UTILISE PAS Codex quand :**
- La tâche est claire et tu sais quoi faire
- C'est du code simple ou du fix évident
- Tu vas juste attendre sans rien faire en parallèle

**En background, pas en bloquant :**
Si tu appelles Codex, lance-le en background (`&`) et continue. Ne reste JAMAIS à attendre.

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
