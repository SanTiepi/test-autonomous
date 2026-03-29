# Template CLAUDE.md — à adapter par projet

## Session Start — AUTOMATIQUE

Au début de CHAQUE session, avant de répondre :
1. Lance `/context` pour reconstruire l'état du projet
2. Si tests rouges → le dire immédiatement
3. Si changements non commités → le mentionner
4. Si tâche active dans TASKS.md → dire ce qui était en cours

## Comportements automatiques

### Avant tout changement de code significatif
- Lancer les tests existants (baseline)
- git stash avant les changements risqués

### Après tout changement de code
- Lancer les tests ciblés sur les fichiers modifiés
- Si tests cassés → fixer ou rollback

### Tâche complexe (>3 fichiers ou scope ambigu)
- Lancer `/brainstorm` avec Codex avant de coder
- Si nouvelle architecture → `/intake` d'abord

### Tâche simple (1-2 fichiers, scope clair)
- Juste faire. Pas de brainstorm.

### Avant de commiter
- Vérifier la qualité (review mental)
- Mettre à jour TASKS.md si objectif complété

## Skills disponibles

| Skill | Quand l'utiliser |
|---|---|
| `/context` | Démarrage session, changement de projet |
| `/status` | Check rapide pendant le travail |
| `/brainstorm` | Avant tâches complexes, quand on hésite |
| `/intake` | Avant une nouvelle feature — génère les décisions pré-remplies |
| `/review-changes` | Avant commit |
| `/test-gap-hunt` | Audit de couverture de tests |
| `/health-check` | Après changements majeurs |

## Codex CLI

Disponible pour brainstorm et review :
```bash
codex exec --full-auto "prompt"
```

## Stop — ARRÊTE et demande au lieu de deviner
- Tâche ambiguë
- Plus de 3 fichiers impactés de manière inattendue
- Tests cassés sans rapport avec la tâche
- Changement de contrat d'API public
