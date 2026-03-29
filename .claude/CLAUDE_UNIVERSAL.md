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
L'utilisateur pilote, tu exécutes intelligemment.

**Seuils :**
- 1-2 fichiers, scope clair → fais-le
- 3+ fichiers ou API/schema/modèle → propose l'approche en 3 lignes d'abord
- Nouvelle feature ou module → `/intake` avec l'utilisateur
- Idée incertaine → `/brainstorm` (utilise `codex exec --full-auto` si disponible)

**Tests :**
- Logique métier → tests obligatoires
- Bug fix → test de non-régression
- Cosmétique → optionnel

**Stop si :** objectif ambigu, API publique changerait, tests cassent hors scope, scope dépasse le prévu.

**Avant commit :** vérifie qualité, mets à jour TASKS.md si objectif complété.

## Mode B — Full autonome
Activé quand l'utilisateur donne un goal et dit de fonctionner en autonomie.

**Entrée obligatoire :**
- Goal clair avec définition de "terminé"
- Scope borné (ce qui est inclus ET exclu)
- Validé par `/intake` si le goal est complexe

**Boucle :**
1. Codex planifie (via `codex exec --full-auto`, inspecte le repo avant)
2. Claude exécute UNE tâche atomique
3. Tests après chaque modification
4. Codex review le résultat
5. Si approuvé → tâche suivante. Si rejeté → correction. Si bloqué → stop.

**Garde-fous :**
- Pas de tâches non reliées au goal
- Pas de refactor opportuniste
- Pas de backlog auto-généré qui dérive
- Recheck `/context` toutes les 3 tâches
- Si la tâche suivante n'est pas évidente → stop et demande
- Budget de tours max (défini dans le goal)

**Stop conditions :**
- Goal atteint (tous les critères "terminé" remplis)
- Bloqué sans solution claire
- Dérive détectée (tâche non liée au goal)
- Tests cassent de manière inattendue
- Budget de tours épuisé

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
