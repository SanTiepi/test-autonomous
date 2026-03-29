# CLAUDE.md — Template universel

> Copier dans le CLAUDE.md de chaque projet. Adapter la section "Projet" uniquement.

## Projet
- Nom : [nom]
- Stack : [stack]
- État : [actif / maintenance / frozen]
- Objectif courant : [1 ligne]

## Sources de vérité
1. Instruction de l'utilisateur (toujours prioritaire)
2. Ce fichier
3. Code existant + tests
4. Docs du repo

## Session start
Lance `/context` silencieusement. Résume en 2-3 lignes : tests, fichiers dirty, tâche en cours.

## Mode A — Assisté (défaut)
L'utilisateur pilote, tu exécutes intelligemment. Les skills s'enchaînent naturellement :

**Flow automatique :**
```
Instruction de l'utilisateur
  → si idée floue/risquée → /brainstorm avec Codex
  → si feature complexe → /intake (brief pré-rempli, utilisateur valide)
  → code
  → tests ciblés automatiques
  → si tests fail → /fix-loop (diagnostic→fix→retest, max 3 tours)
  → si tests verts → review mental (go/no-go en 1 ligne)
  → commit si go
```

L'utilisateur n'appelle pas les skills — ils se déclenchent quand le contexte le demande.

**Seuils :**
- 1-2 fichiers, scope clair → fais-le
- 3+ fichiers ou API/schema/modèle → propose l'approche en 3 lignes d'abord
- Nouvelle feature ou module → `/intake` avec l'utilisateur
- Idée incertaine → `/brainstorm` (utilise `codex exec --full-auto`)

**Tests :**
- Après chaque modification → tests ciblés automatiques
- Si fail → `/fix-loop` automatique (max 3 itérations)
- Logique métier → tests obligatoires
- Bug fix → test de non-régression

**Stop si :** objectif ambigu, API publique changerait, tests cassent hors scope, /fix-loop échoue 3 fois.

## Mode B — Full autonome
Activé quand l'utilisateur donne un goal et dit de fonctionner en autonomie.

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
- Stop si : goal atteint, bloqué, dérive détectée, budget épuisé, /fix-loop échoue 3 fois de suite

## Skills disponibles
Utilise-les quand le contexte le demande, pas systématiquement :
- `/context` — reprendre un projet après absence
- `/brainstorm` — quand >1 approche crédible ou risque élevé
- `/intake` — avant feature complexe, cadrage pré-rempli
- `/status` — check rapide
- `/review-changes` — avant commit
- `/test-gap-hunt` — audit couverture tests

## Codex CLI
`codex exec --full-auto "prompt"` — deuxième IA avec accès repo complet.
Utilise pour : brainstorm, review, second avis. Pas pour l'exécution directe.
