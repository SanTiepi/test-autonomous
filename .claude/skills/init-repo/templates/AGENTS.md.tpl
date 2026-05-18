# AGENTS.md — `{{slug}}`

Doctrine du repo pour les agents IA (Claude Code, Codex, etc.). À lire avant de toucher au code.

## Identité du projet

- **Nom** : {{name}}
- **Slug studio** : `{{slug}}` (clé dans `apps.json` du carnet, slug pour `/api/handoff/{{slug}}`)
- **Statut** : `{{status}}` (production | staging | dev | dormant | archived)
- **GitHub** : {{github_repo_or_dash}}
- **Déploiement** : {{deploy_url_or_no_deploy}}
- **Container Docker** (VPS Batiscan) : {{container_or_dash}}

## Doctrine (à remplir)

- **Objectif central :**
- **Ce qu'on n'y fait PAS :**
- **Audience :**
- **Stack imposée ou flexible :**
- **Dépendances avec d'autres projets du studio :**

## Conventions (forcées par le studio)

### Communication
- Robin communique en français. Tonus direct, no-BS.
- Quality > speed. Toujours.

### Mémoire
- Si présent : `.claude/memory/` versionné en git, modèle Batiscan-V4 (cf. `~/.claude/CLAUDE.md` global).
- À l'entrée de session : `/salut` lit le dernier handoff via `GET /api/handoff/{{slug}}/latest`.
- À la sortie de session : `/bye` compose un handoff + POST `/api/handoff/{{slug}}`.

### Commits
- Format : `type(scope): résumé` (feat, fix, chore, refactor, docs, test, deploy…).
- Footer obligatoire : `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Pas de `--no-verify`, pas de push --force, jamais d'amend sur commit pushé.

### Tests
<!-- À compléter : commande de tests, framework, couverture attendue. -->

## Anti-narration

Ne PAS push, déployer, modifier l'infra, ni commit sans validation Robin explicite — sauf si la skill courante le permet (rares cas marqués `auto-apply`).

## Credentials

Tous dans Bitwarden. Cf. `~/.claude/CLAUDE.md` global pour le wrapper `bw-auto.ps1` et les fallbacks.
