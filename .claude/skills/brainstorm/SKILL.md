---
name: brainstorm
description: "Brainstorm adaptatif Codex↔Claude. Usage: /brainstorm <idée>. S'adapte automatiquement: rapide pour petites questions, profond pour grandes idées."
user-invocable: true
---

# Brainstorm Adaptatif

L'utilisateur donne une idée. Tu brainstorms avec Codex CLI. Le niveau de profondeur s'adapte automatiquement.

## Classification automatique

Avant tout, classifie l'idée :

**Quick** (réponse en 15s, ~10 lignes) — si c'est :
- Une question technique simple ("devrait-on utiliser X ou Y ?")
- Un petit ajustement ("ajouter un champ Z au modèle")
- Une optimisation mineure

**Standard** (réponse en 30s, ~20 lignes) — si c'est :
- Une nouvelle feature
- Un changement d'architecture
- Un pivot produit

**Deep** (réponse en 60s, ~30 lignes) — si c'est :
- Une idée stratégique ou business
- Un changement fondamental d'approche
- Une idée qui touche plusieurs systèmes/projets

## Étape 1 — Contexte

Lis rapidement CLAUDE.md ou README.md (premières lignes) pour identifier le projet. Résume en 1 phrase.

## Étape 2 — Appel Codex

### Mode Quick
```bash
codex exec --full-auto "Projet: [CONTEXTE]. Idée: [IDÉE]. Inspecte le code seulement si ça rend ta réponse plus pertinente. Réponds en français. VERDICT: go/pivot/kill. POURQUOI. MIEUX: une meilleure approche si elle existe."
```

### Mode Standard
```bash
codex exec --full-auto "Projet: [CONTEXTE]. BRAINSTORM: [IDÉE]. Inspecte le code nécessaire pour ancrer ta réponse dans la réalité du projet. Réponds en français, sois brutal, remets en question les hypothèses implicites, propose des angles nouveaux. FORCE. FAIBLESSE. RISQUE. ALTERNATIVE: une approche radicalement différente et potentiellement meilleure. VERDICT: go/pivot/kill + pourquoi. EFFORT. IMPACT."
```

### Mode Deep
```bash
codex exec --full-auto "Projet: [CONTEXTE]. BRAINSTORM PROFOND: [IDÉE]. Inspecte le code en profondeur pour comprendre ce qui existe, ce qui manque, et les opportunités cachées. Challenge chaque hypothèse. Réponds en français, sois brutal ET visionnaire. FORCES. FAIBLESSES. RISQUES (court + long terme). ANGLES INEXPLORÉS: pistes auxquelles personne n'a pensé — sois créatif. MEILLEURE VERSION DE L'IDÉE: reformule en mieux. VERDICT: go/pivot/kill. EFFORT. IMPACT. DÉPENDANCES."
```

**Timeout et fallback :**
- **Quick** : ne lance PAS Codex. Tu réponds seul — c'est plus rapide et Codex n'ajoute rien sur du trivial.
- **Standard** : timeout Codex 45s. S'il ne répond pas, tranche seul et présente. Si Codex arrive en retard, ajoute un "Addendum Codex" en dessous.
- **Deep** : Codex obligatoire, même si lent. Attends jusqu'à 90s. Sans Codex, le Deep perd sa valeur.

**Cache contexte :** Si `.claude/codex_context.md` existe, passe son contenu en prefix au lieu de re-décrire le projet à chaque appel. Crée ce fichier après le premier brainstorm du projet avec un résumé de 5 lignes (nom, stack, état, contraintes, objectif).

## Étape 3 — Ton avis

Ajoute ta perspective en te basant sur ta connaissance du code :
- **Quick** : 1-2 lignes — accepte ou conteste le verdict
- **Standard** : 3-5 lignes — accepte, conteste, enrichis techniquement
- **Deep** : 5-8 lignes — accepte, conteste, enrichis, propose des connexions avec l'existant, explore un angle que Codex a raté

## Étape 4 — Présentation

### Quick
```
**[IDÉE en 5 mots]** → [go/pivot/kill] | [1 ligne pourquoi] | [mieux: alternative si pivot]
```

### Standard
```
## Brainstorm: [titre]

**CODEX:** [verdict] — [raison]
**Forces:** [1 ligne] | **Faiblesses:** [1 ligne]
**Risque:** [1 ligne]

**CLAUDE:** [enrichissement 1-2 lignes]

**Verdict:** [go/pivot/kill] | Effort: [x] | Impact: [x]
**Next:** [1 action concrète]
```

Si go/pivot, ajoute 3 étapes techniques.

### Deep
```
## Brainstorm profond: [titre]

### Ce que Codex voit
**Forces:** [résumé]
**Faiblesses:** [résumé]
**Risques:** [court terme] + [long terme]
**Angles inexplorés:** [2 pistes nouvelles]

### Ce que Claude ajoute
[5-8 lignes d'analyse technique + connexions avec l'existant]

### Meilleure version de l'idée
[Reformulation enrichie en 3 lignes]

### Verdict
[go/pivot/kill] | Effort: [x] | Impact: [x]
Dépendances: [ce qui doit exister avant]

### Plan si go
1. [étape]
2. [étape]
3. [étape]
```

## Étape 5 — Log

Ajoute dans `.claude/brainstorm_log.md` :
```
- [date] [quick/standard/deep] [verdict] [titre] — [1 ligne]
```

## Règles
- Ne demande JAMAIS à l'utilisateur "quel mode veux-tu ?" — classifie toi-même
- Si l'idée est bonne, explore comment la rendre ENCORE meilleure
- Si l'idée est mauvaise, propose TOUJOURS une alternative
- Sois visionnaire sur le Deep : "et si on allait plus loin..."
- Le but n'est pas de valider — c'est d'ÉPROUVER et ENRICHIR
