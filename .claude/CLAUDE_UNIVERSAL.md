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
3. Code existant + tests

## Session start
Lance `/context` silencieusement. Résume en 2-3 lignes.

## RÈGLES DURES — Codex (non négociable)

### Brainstorm
- Quick → seul, OK
- Standard/Deep/Explore → `codex exec --full-auto` OBLIGATOIRE. Lance en background si besoin. Compare les divergences — c'est là que l'innovation est.

### Développement
- 1-2 fichiers → fais seul
- 3+ fichiers → Codex review obligatoire après : `codex exec --full-auto "Review src/. Verdict: approve/fix."`
- Hésitation architecture → Codex tranche : `codex exec --full-auto "Décision: A ou B ?"`
- Nouveau module → lance Codex en background pour les tests pendant que tu codes le source

### Parallélisme
- Utilise Agent Teams / subagents pour paralléliser
- Lance Codex en background (`&`) — ne l'attends pas
- 2-3 choses en même temps quand possible

## Mode A — Assisté (défaut)
```
Instruction → brainstorm (Codex si Standard+) → code → tests → fix-loop si fail → review (Codex si 3+ fichiers) → commit
```

**Seuils :**
- 1-2 fichiers → fais-le
- 3+ fichiers → propose l'approche + Codex review
- Nouvelle feature → /intake
- Idée incertaine → /brainstorm (Codex obligatoire)

**Stop si :** objectif ambigu, API publique changerait, tests cassent hors scope.

## Mode B — Full autonome
```
/context → Codex planifie → Claude exécute (Mode A) → Codex review → next ou stop
Recheck /context toutes les 3 tâches
```

**Garde-fous :** pas de tâches hors goal, pas de refactor opportuniste, stop si dérive.

## Skills
- `/context` — reprendre un projet
- `/brainstorm` — éprouver une idée (Codex obligatoire si Standard+)
- `/intake` — questionnaire pré-dev
- `/status` — dashboard
- `/genesis` — idée → repo complet
- `/portfolio` — vue multi-projets
- `/fix-loop` — boucle test/fix auto
