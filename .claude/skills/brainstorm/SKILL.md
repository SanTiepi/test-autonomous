---
name: brainstorm
description: "Brainstorm adaptatif Codex↔Claude. Usage: /brainstorm <idée>. S'adapte au poids de la question."
user-invocable: true
---

# /brainstorm

L'utilisateur donne une idée. Tu brainstorms avec Codex. La profondeur s'adapte automatiquement.

## Classifie l'idée

- **Quick** — question technique, petit ajustement, oui/non
- **Standard** — nouvelle feature, changement d'architecture, pivot
- **Deep** — stratégie produit/business, changement fondamental, multi-systèmes

## Contexte

Lis CLAUDE.md ou README.md (premières lignes). Si `.claude/codex_context.md` existe, utilise-le au lieu de re-décrire le projet.

Sinon crée-le après ce brainstorm (5 lignes : nom, stack, état, contraintes, objectif).

## Quick — Claude seul, pas de Codex

Réponds toi-même en 3-5 lignes. Verdict + pourquoi + alternative si pertinent. C'est tout.

## Standard — Codex + Claude

Appelle Codex. Adapte le prompt à la question — pas de template rigide. Donne-lui :
- Le contexte projet (court)
- L'idée
- Dis-lui d'inspecter le code pertinent à la question
- Dis-lui de répondre en français, d'être brutal et honnête
- Demande : forces, faiblesses, risque, alternative, verdict (go/pivot/kill), effort, impact

Timeout 45s. Si Codex ne répond pas, tranche seul et ajoute un addendum quand il arrive.

Puis ajoute ton avis : ce que tu acceptes, ce que tu contestes, enrichissement technique basé sur le code.

Présente le résultat — la longueur s'adapte à la complexité de la question. Pas de format rigide. L'important c'est : verdict clair, raison, prochaine action.

## Deep — Codex obligatoire

Même flow que Standard mais :
- Dis à Codex d'inspecter le code en profondeur
- Demande aussi : angles inexplorés, meilleure version de l'idée, dépendances
- Timeout 90s
- Ton avis est plus développé : connexions avec l'existant, faisabilité détaillée, risques techniques
- Propose un plan si go/pivot

## Après chaque brainstorm

Ajoute une ligne dans `.claude/brainstorm_log.md` :
```
- [date] [quick/standard/deep] [verdict] [titre] — [1 ligne]
```

## Principes

- La longueur de la réponse est proportionnelle au poids de la question
- Le but c'est DÉCIDER, pas EXPLORER indéfiniment
- Si l'idée est bonne, dis comment la rendre ENCORE meilleure
- Si l'idée est mauvaise, propose TOUJOURS une alternative
- Pas de complaisance, pas de pessimisme gratuit
