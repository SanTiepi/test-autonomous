# CLAUDE.md — Template universel

> Copier dans le CLAUDE.md de chaque projet. Adapter la section "Projet".

## Projet
- Nom : [nom]
- Stack : [stack]
- État : [actif / maintenance / frozen]
- Objectif courant : [1 ligne]

## Sources de vérité
1. Instruction de l'utilisateur (toujours prioritaire)
2. Ce fichier
3. Code + tests

## Session start
Lance `/context` silencieusement. Résume en 2-3 lignes.

## Codex — quand l'utiliser (et quand NE PAS)

Codex (`codex exec --full-auto`) est un deuxième cerveau avec des biais différents. Il apporte de la valeur quand tu as besoin d'un REGARD EXTÉRIEUR. Pas pour tout.

**UTILISE Codex quand :**
- Brainstorm mode Explore — obligatoire, c'est là que les divergences créent de la valeur
- Décision d'architecture structurante — quand 2 approches se valent et qu'il faut trancher
- Tu es bloqué — un regard frais débloque souvent
- Review d'un changement risqué — avant de merger quelque chose qui touche le coeur du système

**N'UTILISE PAS Codex quand :**
- La tâche est claire et tu sais quoi faire
- C'est du code simple ou du fix évident
- Tu vas juste attendre sa réponse sans rien faire en parallèle
- Le brainstorm est Quick ou Standard simple

**En background, pas en bloquant :**
- Si tu appelles Codex, lance-le en background (`&`) et continue à travailler
- Ne reste JAMAIS à attendre Codex sans rien faire

## Mode A — Assisté (défaut)
```
Instruction → brainstorm si incertain → code → tests → fix-loop si fail → review → commit
```

**Seuils :**
- 1-2 fichiers → fais-le
- 3+ fichiers → propose l'approche d'abord
- Nouvelle feature → /intake
- Idée incertaine → /brainstorm

**Stop si :** objectif ambigu, API publique changerait, tests cassent hors scope.

## Mode B — Full autonome
```
/context → planifie → exécute (Mode A) → review → next ou stop
Recheck /context toutes les 3 tâches
```

**Garde-fous :** pas hors goal, pas de refactor opportuniste, stop si dérive.

## Skills
- `/context` — reprendre un projet
- `/brainstorm` — éprouver une idée (Explore = Codex obligatoire)
- `/intake` — questionnaire pré-dev
- `/status` — dashboard
- `/genesis` — idée → repo complet
- `/portfolio` — vue multi-projets
- `/fix-loop` — boucle test/fix auto

## Commandes
```bash
npm test
codex exec --full-auto "prompt"
```
