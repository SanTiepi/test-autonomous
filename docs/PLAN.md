# Plan — Prochaines étapes

## Situation actuelle
- Orchestra fonctionne : Codex planifie (avec tools), Claude implémente, watcher orchestre
- Preuve : bookmark manager construit en autopilote (8 endpoints, 27 tests, $0.02)
- 265 tests / 55 suites / 0 fail
- Bugs connus : session isolation (TOOL-05), checkpoint bloque le process

## Phase 1 — Fiabiliser (prérequis pour scaler)

### TOOL-05 : Session isolation
**Problème** : un seul state.json pour toutes les sessions. `start` écrase, `resume` reprend la mauvaise session.
**Fix** : state.json nommé par session (`state_<session_id>.json`) + fichier `active_session` pointeur. `resume` lit le pointeur, `start` crée un nouveau pointeur.
**Priorité** : critique — sans ça, impossible de relancer proprement après un checkpoint.

### TOOL-06 : Checkpoint non-bloquant
**Problème** : le watcher s'arrête au checkpoint, le process meurt, il faut `resume` + `approve` manuellement.
**Fix** : le watcher reste vivant en `wait_human`, poll l'approve.json. Pas de sortie de process au checkpoint.
**Priorité** : haute — c'est la raison principale pour laquelle l'autopilote a besoin d'intervention.

### TOOL-07 : Observabilité temps réel
**Problème** : on monitore via `sleep N && node -e "..."` — primitif et lent.
**Fix** : `node orchestra.mjs watch` qui tail les events.ndjson en temps réel avec formatage. Un seul terminal pour tout voir.
**Priorité** : moyenne — confort mais pas bloquant.

## Phase 2 — Self-improvement (le système s'améliore lui-même)

### TOOL-03 : Auto-refactor
Lancer un cycle Orchestra où le goal est : "refactor le système Orchestra lui-même".
- Codex review le code d'Orchestra, identifie les problèmes
- Claude fixe, teste
- Prouve que le système peut se modifier en toute sécurité

### TOOL-08 : Prompt learning
Exploiter les `meta_feedback` accumulés dans les archives pour auto-tuner les prompts.
- Analyser tous les meta_feedback de toutes les sessions
- Identifier les patterns : quels champs sont redondants, quel contexte manque
- Ajuster prompt_builder automatiquement

## Phase 3 — Vrais projets

### PROJ-01 : Module SwissBuilding
Migrer un module existant de SwissBuilding dans la boucle Orchestra.
- Codex analyse le module, planifie la migration
- Claude implémente, teste
- Valide que le système fonctionne sur du code réel, pas juste des demos

### PROJ-02 : Service from scratch
Construire un vrai service utile (pas un todo/bookmark) entièrement via Orchestra.
Candidats :
- API de gestion documentaire (upload, metadata, search, tags)
- Service de monitoring/alerting pour les autres projets
- Bridge API entre deux systèmes existants

### PROJ-03 : Multi-repo
Orchestra gère plusieurs repos. Codex coordonne des changes cross-repo.
- Besoin : config multi-repo, contexte switching
- Le plus ambitieux, à ne faire qu'après PROJ-01 et PROJ-02

## Ordre recommandé

```
TOOL-05 (session isolation)     ← fix critique, 1h
TOOL-06 (checkpoint vivant)     ← fix haute priorité, 1h
TOOL-07 (watch command)         ← confort, 30min
TOOL-03 (auto-refactor)         ← preuve de maturité, 1 cycle
PROJ-01 (SwissBuilding module)  ← premier vrai projet
PROJ-02 (service from scratch)  ← deuxième vrai projet
```

Les 3 premiers TOOL peuvent être faits dans la session actuelle.
TOOL-03 est un cycle autonome (on lance et on regarde).
PROJ-01+ dépend de ta décision sur quel module/service viser.
