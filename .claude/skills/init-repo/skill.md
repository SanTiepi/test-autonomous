---
name: init-repo
description: "Génère le minimum de structure manquant dans un repo du studio (README.md, AGENTS.md, .env.example, DEPLOYMENT.md) à partir de templates et des champs du registre apps.json. Dry-run par défaut, applique après validation Robin. Usage : /init-repo <slug>"
user-invocable: true
---

# /init-repo — Bootstrap minimum d'un repo du studio

Quand Robin tape `/init-repo <slug>`, tu génères les fichiers manquants qui font partie du **minimum vital studio** pour qu'un repo soit lisible par n'importe quel agent IA (toi, Codex, autre Claude) et un nouveau venu.

Fichiers cibles : `README.md`, `AGENTS.md`, `.env.example`, `DEPLOYMENT.md`.

## Garde-fous absolus

- **Ne JAMAIS écraser un fichier existant.** Si un des 4 fichiers est déjà là, on skip (et on le dit à Robin). Si Robin veut le régénérer, il l'efface lui-même d'abord ou demande explicitement `--force`.
- **Dry-run par défaut.** Tu montres les contenus à Robin AVANT d'écrire quoi que ce soit. Robin doit dire "ok" / "apply" / "valide".
- **Pas de commit auto.** Une fois les fichiers écrits, tu propose les ajouts en `git add`, mais le commit est validé par Robin.

## Étape 1 — Slug et registre

Si Robin a passé le slug en argument : `/init-repo cortex` → slug = `cortex`.
Sinon, déduis-le du dossier courant ou demande à Robin.

**Fetch la fiche tech depuis l'API** :

```bash
curl -s -u "robin:$BASIC_PWD" https://robinetclaude.ch/api/apps/<slug>
```

Si le slug n'est pas dans `apps.json` (404) :
1. Propose à Robin de l'ajouter (édition `studio-portfolio/apps.json` puis commit).
2. Ne génère pas les templates tant qu'il n'est pas dans le registre — sinon les valeurs `{{name}}`, `{{deploy_url}}`, etc. seront vides.

**Alternative offline** : lire directement `c:\PROJET IA\studio-portfolio\apps.json` si présent sur la machine. Plus rapide, pas besoin de basic auth.

## Étape 2 — Préparer les substitutions

Les templates utilisent ces placeholders (cf. `templates/*.tpl`) :

| Placeholder | Source | Valeur si absente |
|---|---|---|
| `{{slug}}` | apps.json key | requis |
| `{{name}}` | apps.json `.name` | slug lui-même |
| `{{status}}` | apps.json `.status` | `dev` |
| `{{github_repo}}` | apps.json `.github_repo` | (vide) |
| `{{github_repo_or_dash}}` | idem ou `—` | `—` |
| `{{container}}` | apps.json `.container` | (vide) |
| `{{container_or_dash}}` | idem ou `—` | `—` |
| `{{deploy_url}}` | apps.json `.deploy_url` | (vide) |
| `{{deploy_url_or_no_deploy}}` | `Déployé à <url>` ou `Pas encore déployé` | `Pas encore déployé` |

Substitution simple : pour chaque placeholder, `content.replaceAll('{{key}}', value)`.

## Étape 3 — Inventaire des fichiers à générer

Pour chaque fichier cible, vérifie son existence :

```bash
ls README.md AGENTS.md .env.example DEPLOYMENT.md 2>/dev/null
```

Sépare en 3 listes :
- **À générer** : fichiers absents
- **Déjà présents** : on skip
- **À régénérer (force)** : si Robin a passé `--force` ET le fichier existe

### Choisir la bonne variante pour `DEPLOYMENT.md`

Selon `apps.json` :
- Si `container` ET `deploy_url` sont définis → utiliser `templates/DEPLOYMENT.md.tpl` (variante VPS Batiscan complète).
- Si l'un des deux est `null` → utiliser `templates/DEPLOYMENT.local.md.tpl` (variante "pas encore déployé", build local seulement + checklist pour quand le deploy arrivera).

## Étape 4 — Présenter les diffs à Robin

Pour chaque fichier à générer, lis le template (`~/.claude/skills/init-repo/templates/<file>.tpl`), substitue les placeholders, et affiche le contenu final dans le chat. Format :

```
📄 README.md (nouveau)
[contenu après substitution]
```

Puis demande :
> "Voici les <N> fichiers prêts à écrire. Tu valides (`apply`), tu corriges (`patch <fichier> : <changement>`), ou tu cancel ?"

## Étape 5 — Écrire les fichiers (après "apply")

Une fois Robin OK :
1. Écrire chaque fichier avec le contenu substitué (utiliser `Write` tool).
2. `git add` les nouveaux fichiers.
3. **Ne PAS commit.** Propose le message à Robin :

```
chore: init repo minimum (README + AGENTS + .env.example + DEPLOYMENT)

Généré via /init-repo <slug>. Templates : test-autonomous/.claude/skills/init-repo/templates/.
À compléter manuellement les sections marquées "À compléter".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## Étape 6 — Sortie

Confirme à Robin :
> "✓ <N> fichiers générés et stagés. À compléter : les sections `<!-- À compléter -->`. Tu valides le commit ?"

Liste les sections vides à remplir prioritairement (typiquement : doctrine dans AGENTS.md, stack dans README, secrets précis dans .env.example).

## Cas spéciaux

### Repo Tier 1 (Batiscan-V4, Cortex)
Ces repos ont déjà leur propre `AGENTS.md` plus complet et un système mémoire mature. **Skip-les** ou demande explicitement à Robin avant. Risque : écraser des conventions plus riches que le template générique.

### Pas de remote GitHub (worldengine, freetime)
Le template AGENTS.md gère `{{github_repo_or_dash}} = "—"`. Pas bloquant.

### Pas de container Docker (test-autonomous, worldengine, trankill)
Le template DEPLOYMENT.md devient un guide local-only. À adapter manuellement.

### Slug pas encore dans apps.json
Refuse de générer (les placeholders seraient vides). Propose à Robin d'ajouter une ligne dans `studio-portfolio/apps.json` et de relancer.

## Mise à jour de l'écosystème

Quand on bootstrappe un repo, **n'oublie pas** de mettre à jour les références extérieures :
- `studio-portfolio/apps.json` : status, container, deploy_url si récents.
- `studio-portfolio/projects.base.json` : si la fiche carnet n'existe pas, propose `/studio-update <slug> "Bootstrap initial"`.
- Si tests verts post-bootstrap : optionnellement `/bye` pour poser un handoff "init effectué".

## Liens avec d'autres skills

- `/salut` : si présent, le dernier handoff peut mentionner "init manquant" → `/init-repo` est la suite logique.
- `/bye` : à la fin de session, si tu as bootstrappé un repo, mentionne-le dans `what_done`.
- `/studio-update` : pour ajouter une ligne de log de bootstrap dans la fiche carnet.
