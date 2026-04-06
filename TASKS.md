# Studio Robin — Tableau de bord

> Dernière mise à jour : 2026-04-06
> Ce fichier est la source de vérité pour tous les projets.

## Priorités (dans l'ordre)

| # | Projet | Action immédiate | Pourquoi |
|---|--------|-----------------|----------|
| 1 | **Habiter** | Frontend + dossier preuve PDF + 20 testeurs Morges/Lausanne | Produit citoyen, crée le marché, open source, volume |
| 2 | **Batiscan-V4** | pgvector + Whisper + Marker + compta interne | Business qui paie, quick wins stack existante |
| 3 | **Suxe** | PeerShield + Coffre-Fort Incident | Safety solo meetings, repositionné |
| 4 | **NegotiateAI** | Web app + bot Telegram pour amis | Feedback réel sur le produit |
| 5 | **WorldEngine** | Stabiliser orchestrate/compose | Brique de simulation |
| 6 | **test-autonomous** | Pipeline diet + Fractal V2 | Infrastructure du studio |

**GELÉ :** SwissBuilding — infrastructure prête, en attente de données Habiter + Batiscan. Renaît quand Habiter a 1000+ utilisateurs.

## État des projets

| Projet | Tests | Branche | Dernier commit | État |
|--------|-------|---------|----------------|------|
| SwissBuilding | 8000+ (pytest) | building-life-os | gelé | **GELÉ** — infra prête, attend données Habiter+Batiscan |
| NegotiateAI | 400 | master | 12h | Dev actif — web app + 20 scénarios |
| Batiscan-V4 | 3056 (pytest) | main | 30h | Prod — maintenance |
| WorldEngine | 573 | master | 12h | Dev actif — MCP + presets |
| test-autonomous | 479 | master | 2j | Stable — control plane |
| Suxe | 148 | main | 10j | Pivot safety solo meetings — PeerShield + Coffre-Fort |
| Habiter | 12 | master | actif | **PRIORITÉ #1** — copilote domestique OS, MVP app-first, OpenClaw 1x/h |
| OrbitPilot | 62 | master | 5j | En pause |
| PulseOps | 25 | master | 5j | Done v1 |

## Projets archivés / dormants

| Projet | Statut | Action |
|--------|--------|--------|
| EpistemicLayer | Abandonné | babel-epistemic + clarity-gate le remplacent |
| NeuralShop | 3 sem sans commit | À archiver si pas de plan |
| benoit-v2 / benoit-ecosystem | Abandonné | N'apporte rien qu'une lib TS ne fait pas (décision 2026-04-06) |
| batiscan (ancien) | 4 sem | Remplacé par Batiscan-V4 |

## Pipeline autonome (OpenClaw)

**Statut : DIET MODE** (relancé 2026-04-05 — 4 crons légers, ~850k tokens/semaine)

4 jobs actifs (vs 14 avant) :
- `dev-runner-diet` (3h, 1x/jour, Sonnet) — 1 brief SwissBuilding/nuit, 30 min max
- `health-check` (8h, 1x/jour, Haiku) — tests SwissBuilding, issue si rouge
- `idea-machine` (toutes les 2h, 12x/jour, Haiku) — idées produits uniques, croisements domaines
- `weekly-review` (lundi 8h, 1x/sem, Sonnet) — bilan hebdo SwissBuilding

**Garde-fous :**
- Zéro self-relaunch, zéro meta-CTO, zéro boucle haute fréquence
- lightContext: true partout, timeouts stricts (300-1800s)
- Si 3 erreurs consécutives → désactiver le job
- 25 briefs SwissBuilding prêts dans `.openclaw/tasks/`

**Leçons v1 (à ne pas répéter) :**
- OpenClaw mange les tokens 5-10x plus vite que Claude Code direct
- Le meta-CTO (agent superviseur) est dangereux — il modifie la config des autres
- Les dev-runners qui bouclent sur "docs: refresh soul" = pattern toxique
- Le brief-first (v4) fonctionne : 2 min/tâche au lieu de 10

**Scaling (si budget OK après 2 semaines) :**
- Phase 2 : ajouter prospect-sim (mercredi) + 2e dev-runner (15h)
- Phase 3 : ajouter monthly-trends (1er du mois)
- Jamais dépasser 7 jobs

## Décisions clés

| Date | Décision |
|------|----------|
| 2026-04-02 | SwissBuilding ≠ BIM. C'est l'ordonnance du bâtiment, pas la maquette |
| 2026-04-02 | Position B→C→A : régies d'abord, autorités ensuite, plugin BIM en option |
| 2026-04-02 | Tester avec amis propriétaires avant prospection commerciale |
| 2026-04-01 | USE don't BUILD : chercher 30 min avant de coder 1 ligne |
| 2026-04-01 | Focus > Abstraction : 1 produit mature > 8 embryonnaires |
| 2026-03-30 | WorldEngine = produit standalone, distribué via SwissBuilding (modèle Stripe) |
| 2026-04-06 | Habiter = nouveau projet, copilote domestique open source, capteurs + IA + preuve + action |
| 2026-04-06 | Benoit lang abandonné — n'apporte rien qu'une lib TS ne fait pas |
| 2026-04-06 | Suxe repositionné "safety for solo meetings" (pas escort/TdS) |
| 2026-04-06 | Batiscan : 12 nouvelles tâches (TASK-253 à 264), pgvector + Whisper + Marker + compta interne |
| 2026-04-06 | Écosystème = 1 graphe, 6 surfaces, pas 6 produits séparés |
| 2026-04-06 | Fractal V2 implémenté — kill-first, court, parallèle Claude+Codex |
| 2026-04-06 | SwissBuilding GELÉ — infra prête, renaît quand Habiter a 1000+ users |
| 2026-04-06 | Habiter = priorité #1 — produit citoyen, crée le marché pour Batiscan + SwissBuilding |
| 2026-04-06 | Architecture : Habiter (entrée citoyen) → Batiscan (production pro) → SwissBuilding (dashboard B2B) |
| 2026-04-06 | Habiter open source MIT, Batiscan propriétaire, SwissBuilding SaaS |
| 2026-04-06 | OpenClaw redirigé : dev-runner-habiter 1x/h, SwissBuilding health-check désactivé |

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
