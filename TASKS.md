# Tasks — Control Plane

## En cours
- `WorldEngine` — simulateur de réalité universel, en construction autonome
- `OrbitPilot` — orchestrateur de priorités, en construction autonome

## Projets actifs
| Projet | État | Description |
|---|---|---|
| **WorldEngine** | building | Simulateur universel — agents LLM qui simulent clients, experts, marchés, équipes |
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

## Innovations système cette session

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
