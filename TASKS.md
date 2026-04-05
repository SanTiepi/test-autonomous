# Studio Robin — Tableau de bord

> Dernière mise à jour : 2026-04-03
> Ce fichier est la source de vérité pour tous les projets.

## Priorités (dans l'ordre)

| # | Projet | Action immédiate | Pourquoi |
|---|--------|-----------------|----------|
| 1 | **SwissBuilding** | Web check-up pour amis propriétaires | Premier feedback utilisateur réel |
| 2 | **NegotiateAI** | Web app + bot Telegram pour amis | Feedback réel sur le produit |
| 3 | **Batiscan-V4** | Maintenance, mails Infomaniak | Business existant, clients réels |
| 4 | **WorldEngine** | Stabiliser orchestrate/compose | Brique de simulation pour SB + NA |
| 5 | **test-autonomous** | Stabiliser le pipeline, ce fichier | Infrastructure du studio |

## État des projets

| Projet | Tests | Branche | Dernier commit | État |
|--------|-------|---------|----------------|------|
| SwissBuilding | 8000+ (pytest) | building-life-os | 12h | Dev actif — 36 programmes livrés, wave 16 |
| NegotiateAI | 400 | master | 12h | Dev actif — web app + 20 scénarios |
| Batiscan-V4 | 3056 (pytest) | main | 30h | Prod — maintenance |
| WorldEngine | 573 | master | 12h | Dev actif — MCP + presets |
| test-autonomous | 479 | master | 2j | Stable — control plane |
| OrbitPilot | 62 | master | 5j | En pause |
| PulseOps | 25 | master | 5j | Done v1 |

## Projets archivés / dormants

| Projet | Statut | Action |
|--------|--------|--------|
| EpistemicLayer | Abandonné | babel-epistemic + clarity-gate le remplacent |
| NeuralShop | 3 sem sans commit | À archiver si pas de plan |
| Suxe | 8j sans commit | À clarifier |
| benoit-ecosystem | 1 commit | À archiver |
| batiscan (ancien) | 4 sem | Remplacé par Batiscan-V4 |

## Pipeline autonome (OpenClaw)

**Statut : ARRÊTÉ** (consomme trop de tokens Anthropic)

Quand relancé, 6 agents (main, swissbuilding, idea-lab, worldengine, negotiateai, batiscan) avec :
- 3 dev-runners (/10 min) — code SwissBuilding, WorldEngine, NegotiateAI
- Idea hunter (/2h) — recherche d'innovations via GPT-5.4
- Auto-triage (/6h) — détecte et fixe les bugs
- Code-review + auto-push (6h45) — review matinal
- Morning brief (7h) + standup (7h30) — rapports Telegram

**Leçons apprises :**
- OpenClaw mange les tokens 5-10x plus vite que Claude Code direct
- Le meta-CTO (agent superviseur) est dangereux — il modifie la config des autres
- Les dev-runners qui boucle sur "docs: refresh soul" = pattern toxique à surveiller
- Le brief-first (v4) fonctionne : 2 min/tâche au lieu de 10

## Décisions clés

| Date | Décision |
|------|----------|
| 2026-04-02 | SwissBuilding ≠ BIM. C'est l'ordonnance du bâtiment, pas la maquette |
| 2026-04-02 | Position B→C→A : régies d'abord, autorités ensuite, plugin BIM en option |
| 2026-04-02 | Tester avec amis propriétaires avant prospection commerciale |
| 2026-04-01 | USE don't BUILD : chercher 30 min avant de coder 1 ligne |
| 2026-04-01 | Focus > Abstraction : 1 produit mature > 8 embryonnaires |
| 2026-03-30 | WorldEngine = produit standalone, distribué via SwissBuilding (modèle Stripe) |

## Comment lancer un agent Claude Code sur un projet

```bash
# Ouvrir Claude Code dans le dossier du projet
cd "C:\PROJET IA\[projet]"
claude

# L'agent lit automatiquement CLAUDE.md et sait quoi faire.
# Pour un mode autonome non-interactif :
claude --permission-mode bypassPermissions --print "Lis CLAUDE.md, identifie la prochaine priorité, implémente-la, teste, commit."
```

## Règles communes (tous les projets)

1. **Langue** : code/commits en anglais, docs/rapports en français avec accents
2. **Tests** : toujours verts avant de commit. Si rouge, fix d'abord.
3. **Commits** : 1 commit = 1 feature/fix. Message clair : `feat:`, `fix:`, `docs:`
4. **Ne pas push** sans review (sauf auto-push via code-review cron)
5. **Pas de dépendances inutiles** : vérifier si ça existe dans le stack avant d'ajouter
6. **Pas de refactor opportuniste** : rester dans le scope de la tâche
