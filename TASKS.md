# Tasks — Control Plane

## En cours
- `WorldEngine` — **FOCUS PRINCIPAL** — produit-noyau standalone, distribué via SwissBuilding (modèle Stripe)
- `OrbitPilot` — orchestrateur de priorités, en pause (focus WorldEngine)
- `OpenClaw` — intégration en cours. 3 agents (main, swissbuilding, idea-lab), 6 crons configurés

## OpenClaw — État intégration (2026-04-01)
- **Gateway** : OK, `ws://127.0.0.1:18789`, version 2026.3.31
- **Agents** : main (Sonnet 4.6), swissbuilding (Sonnet 4.6), idea-lab (Sonnet 4.6)
- **Crons fixés** : delivery channel `last` → `log` (6 jobs), health-check sur Haiku (économie rate limit)
- **Fallback** : Sonnet → Haiku → Codex GPT-5.4 (plus de doublon Sonnet)
- **À tester** : redémarrer OpenClaw et vérifier que les crons passent sans erreur
- **Next** : connecter un canal Discord/Telegram pour notifications, explorer les skills OpenClaw utiles

## Décisions clés (2026-03-30)
- **Focus > Abstraction** : 1 produit mature > 8 projets embryonnaires. WorldEngine = 287 tests + démo LLM réelle + 4 presets immobiliers.
- **WorldEngine ≠ feature SwissBuilding** : repo/CLI/API/pricing séparés. SwissBuilding = premier client, pas propriétaire.
- **Wedge vertical** : préparation avant interaction coûteuse (négo immobilière, présentation diagnostic). Pas de marché horizontal.
- **Marché validé** : Aaru ($1B valuation), Synthetic Users (Gartner leader). Le créneau vertical immobilier est ouvert.
- **Protocole Codex optimisé** : pré-briefing + thèse Claude + divergence forcée = -41% tokens, 4x insights.

## Projets actifs
| Projet | État | Description |
|---|---|---|
| **WorldEngine** | **building — FOCUS** | 287 tests, 22 modules, 11 presets (7 corporate + 4 immobilier), CLI complet, LLM intégré |
| **OrbitPilot** | building | Orchestrateur de priorités pour dev solo — planification probabiliste |
| **PulseOps** | done v1 | Observatoire santé repos Git — 25 tests, 6 modules |
| **test-autonomous** | stable | Control plane — skills, duo mode, outils |
| **SwissBuilding** | maintenance | Building intelligence SaaS — duo mode archivé, Wave 2 done |
| **Batiscan V4** | prod | ERP diagnostic polluants — en maintenance |

## Vision produit découverte en session

### WorldEngine — "Le moteur de mondes"
- Simuler N'IMPORTE QUI : clients, experts, concurrents, régulateurs, équipes, marchés
- Chaque agent = un LLM avec rôle, personnalité, biais, objectifs
- Cas d'usage : focus group virtuel, stress test stratégique, préparation négociation, audit compliance, simulation d'équipe, test pricing
- Promesse : "Teste tes décisions avant de les vivre"
- Potentiel : remplace études de marché, consultants stratégie, panels utilisateurs
- Architecture : CLI + MCP server (pas REST)

### OrbitPilot — "Le copilote qui dit la vérité"
- Planification probabiliste : "ton plan a 62% de chances de tenir"
- Energy-aware : place les tâches complexes aux bons moments cognitifs
- Anti-burnout : détecte la surcharge avant le crash
- Apprentissage personnel : apprend TES biais d'estimation
- Vision tech : moteur Rust/WASM, local-first, CRDT sync
- Timeline physique : tâches avec gravité, vitesse, risque visuel

## Découvertes session 2026-03-30

### Domain Tomography (Deep brainstorm)
- FRACTURE+WorldEngine+Duo = scanner CT pour industries
- Boucle fermée : perception → simulation → construction → validation
- Codex corrige : pas un scanner (passif) mais un **système immunitaire adaptatif** (actif)
- Le moat n'est pas "voir l'invisible" — c'est fermer la boucle plus vite que le marché ne se réorganise
- Test décisif : reproduire le 84% sur un domaine inconnu

### Executable Discovery (Explore wild)
- 10 experts (7 Claude + 3 Codex) convergent : la connaissance qui survit EST son support d'exécution
- Pattern toxique identifié : on met 100% des découvertes en TEXTE, 0% en CONTRAINTES
- 3 mécanismes : Gravité (le terrain force), Précédent (trigger→réponse auto), Geste (savoir=fonction)
- Codex : "une découverte vivante devient gravité opérationnelle" — elle déforme le chemin par défaut
- Next : transformer les principes clés en tests/hooks/agents, pas en docs

### Protocole Codex optimisé
- Avant : Codex perd 80% du budget à lire des fichiers (35k tokens, 6 fichiers lus)
- Après : pré-briefing + divergence forcée + format structuré (21k tokens, 0 fichier, 4 points tranchants)
- Règle : Claude forme sa thèse AVANT, Codex CONTESTE après
- Templates par mode dans le skill brainstorm (Standard/Deep/Explore)

### Cognitive OS (Explore wild écosystème)
- L'écosystème Robin = 8 verbes : PROUVER/SIMULER/SENTIR/RÉVÉLER/PLANIFIER/CONSTRUIRE/SURVEILLER/DÉCIDER
- Chaque projet manque un verbe que seul un AUTRE projet possède
- 5 synergies identifiées : simulation prouvable, diagnostic émotionnel d'industrie, découverte incarnée, planning neuronal, récif complet
- test-autonomous = le kernel du Cognitive OS
- Next : concevoir les ponts entre projets

## Innovations système (sessions précédentes)

### Mode hybride Codex↔Claude
- Codex écrit les tests, Claude implémente pour les faire passer
- Les tests = contrat vivant entre les deux agents
- Boucles courtes module par module
- Optimisation : Codex en background, Claude code en parallèle

### Pensée divergente dans /brainstorm
- Frame breaking : nommer le cadre implicite, le casser
- Contraire vrai : "et si l'opposé était correct ?"
- Analogie forcée : comparer à un domaine complètement différent
- Multi-expert panel : physicien, game designer, neurologue, économiste, chorégraphe

### Panel multi-expert (innovation clé)
- Un LLM peut être N'IMPORTE QUI — pas juste un assistant
- Simuler 1000 clients, un marché entier, un concurrent, un régulateur
- Combinaisons impossibles : "architecte-neuroscientifique", "régulateur du futur"
- C'est ce qui a donné naissance à WorldEngine

### Skills universels déployés dans 6+ repos
- /brainstorm — éprouver une idée avec pensée divergente
- /intake — questionnaire pré-dev pré-rempli
- /context — reprise de projet instantanée
- /status — dashboard universel humain + machine
- /fix-loop — boucle test/fix automatique

### Outils installés
- rg (ripgrep), fd, bat, uv, gh CLI, Codex CLI
- GitHub MCP, Playwright MCP (à configurer)
- Schemathesis, pytest-snapshot (pour projets Python)

## Stats session marathon
- 611+ tests / 166+ suites (test-autonomous seul)
- 25 tests PulseOps, OrbitPilot en cours, WorldEngine en cours
- ~$0.50 total API cost
- 3 produits lancés en autonomie
- Skills déployés dans 6 repos
