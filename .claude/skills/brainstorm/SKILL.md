---
name: brainstorm
description: "Brainstorm adaptatif multi-agents. Usage: /brainstorm <idée>. De la question rapide à l'exploration radicale."
user-invocable: true
---

# /brainstorm

## Classifie

- **Quick** — question simple → Claude seul, 3-5 lignes
- **Standard** — feature, architecture → Codex + Claude, pensée divergente
- **Deep** — stratégie, business → Codex obligatoire, contraire vrai, analogie forcée
- **Explore** — innovation, nouvelles pistes → simulation multi-agents, exploration large

Détecte automatiquement. Ne demande jamais le mode.

## Quick
3-5 lignes. Verdict + pourquoi + alternative.

## Standard
Codex + Claude. Avant tout : cadre implicite, ce qu'il empêche de voir, idée hors cadre. Timeout 45s.

## Deep
Comme Standard + contraire vrai + analogie forcée. Codex obligatoire 90s.

## Explore

Le mode le plus important. On explore LARGE — volontairement trop large au début pour ne rien louper. On affine après.

### Principe fondamental
Ne PAS converger trop vite. Ouvrir le champ au maximum AVANT de trier. Les meilleures idées sont aux intersections les plus improbables.

### Process

**Phase 1 — Ouverture maximale**

Génère 7-10 points de vue radicalement différents. Pas des variations — des MONDES différents :
- 3 experts du sujet (mais de sous-domaines éloignés)
- 3 experts de domaines SANS RAPPORT (sciences, arts, nature, sports, cuisine, musique, médecine, justice, jeux...)
- 1-2 profils impossibles ou inventés ("un historien de l'an 3000", "un océan qui pense", "un enfant-philosophe")

Chaque point de vue : 1 mécanisme transférable de son domaine, pas une opinion. 2 lignes max.

Ne trie PAS encore. Ne juge PAS. Accumule.

**Phase 2 — Collisions**

Prends les points de vue les plus ÉLOIGNÉS et force des collisions par paires :
- Qu'est-ce qui émerge quand on connecte A et B ?
- Quel produit/concept/approche existe à cette intersection ?
- Qu'est-ce qui est IMPOSSIBLE à trouver sans cette collision ?

3-5 collisions. Cherche celles qui produisent un "c'est bizarre mais..." — c'est là que l'innovation est.

**Phase 3 — Patterns**

Regarde l'ensemble des points de vue et collisions. Quels PATTERNS émergent ?
- Qu'est-ce que plusieurs experts disent sans le savoir ?
- Quelle direction revient sous des formes différentes ?
- Quel problème sous-jacent est révélé par les collisions ?

**Phase 4 — Synthèse ouverte**

Présente à l'utilisateur :
- Les 3-5 insights les plus surprenants
- Les 2-3 collisions les plus fertiles
- Le pattern émergent
- 2-3 directions possibles (pas 1 seule — garder le champ ouvert)
- Pour chaque direction : 1 ligne de ce que ça donne concrètement

**Ne conclus PAS.** L'explore ouvre des portes. L'utilisateur choisit laquelle franchir. Si l'utilisateur veut creuser une direction, relance un brainstorm Standard ou Deep dessus.

### Relancer en cours de projet

L'explore n'est pas que pour le début. Relance-le :
- Quand le projet stagne
- Quand une décision importante approche
- Quand l'utilisateur dit "on rate peut-être quelque chose"
- Toutes les 2-3 semaines sur un projet actif

À chaque relance, les experts changent. Le contexte du projet nourrit de nouvelles collisions.

## Protocole Codex (Standard, Deep, Explore)

Codex a accès au repo via CLI. Mais ne le laisse PAS explorer à l'aveugle — pré-briefé + divergence forcée.

### Principe : Claude pense AVANT, Codex conteste APRÈS

```
1. Claude forme sa première thèse (2-3 lignes, position claire)
2. Claude construit le prompt Codex avec :
   - Le contexte essentiel (pas "lis les docs" — le contenu résumé)
   - Sa propre thèse (pour que Codex la conteste)
   - Le format de sortie attendu
3. Codex tourne en background, Claude continue son analyse
4. Claude intègre les divergences de Codex dans la synthèse
```

### Template prompt Codex par mode

**Standard :**
```
Tu es le contradicteur dans un brainstorm duo.
SUJET: {sujet}
CONTEXTE: {2-5 lignes de contexte essentiel, pas "lis les fichiers"}
THÈSE CLAUDE: {la position de Claude en 2-3 lignes}

Ta mission :
1. BLIND_SPOT — Ce que cette thèse ne voit pas (1 point, 2 lignes max)
2. STRONGER — Comment rendre cette thèse plus forte (1 point, 2 lignes max)
3. ALTERNATIVE — Une approche radicalement différente (1 point, 2 lignes max)

Format strict, pas de prose. Si tu veux lire un fichier du repo pour vérifier un fait, fais-le, mais ne lis PAS tout.
```

**Deep :**
```
Tu es le contradicteur dans un brainstorm Deep.
SUJET: {sujet}
CONTEXTE: {contexte essentiel résumé}
THÈSE CLAUDE: {position de Claude}

Ta mission :
1. CONTRAIRE_VRAI — Quelle croyance évidente est fausse ici ? Formule-la. (2-3 lignes)
2. ANALOGIE_FORCÉE — Prends un domaine SANS RAPPORT ({domaine suggéré par Claude}). Quel mécanisme de ce domaine s'applique ici ? (2-3 lignes)
3. BLIND_SPOT — Ce que la thèse de Claude ne voit pas (2-3 lignes)
4. VERDICT — En 1 phrase : qu'est-ce qui change si on combine tout ça ?

Tu peux lire des fichiers du repo si tu as besoin de vérifier un fait précis. Pas de prose, pas de politesse. 300 mots max.
```

**Explore :**
```
Tu es un panel d'experts divergents dans un brainstorm Explore.
SUJET: {sujet}
CONTEXTE: {contexte essentiel résumé}
EXPERTS CLAUDE: {liste des experts que Claude a choisis}

Ta mission — NE PAS dupliquer les experts de Claude. Choisis 3 experts de domaines TOTALEMENT DIFFÉRENTS des siens.

Pour chaque expert :
- ROLE: {domaine}
- MÉCANISME: {1 mécanisme transférable, 2 lignes max}

Puis :
- COLLISION: la collision la plus improbable entre un de tes experts et un de Claude (3 lignes)
- PATTERN: ce que l'ensemble révèle que ni toi ni Claude ne voyez seuls (2 lignes)

Pas de prose. Pas de redondance avec Claude.
```

### Règles d'exécution

- **Toujours en background** (`&`) — Claude ne bloque JAMAIS sur Codex
- **Timeout** : Standard 45s, Deep 90s, Explore 60s
- **Si Codex converge avec Claude** : la synthèse le dit explicitement ("convergence sur X") — c'est un signal fort
- **Si Codex diverge** : c'est LÀ que la valeur est — creuser la divergence, pas la résoudre
- **Codex ne lit le repo QUE si un fait précis doit être vérifié** — le contexte est dans le prompt

## Après chaque brainstorm

`.claude/brainstorm_log.md` :
```
- [date] [mode] [résultat] [titre] — [1 ligne]
```

## Principes

- Quick/Standard/Deep = DÉCIDER. Explore = DÉCOUVRIR.
- En Explore : ne jamais converger trop tôt. La largeur est une force, pas un défaut.
- Les meilleures idées viennent des collisions les plus improbables
- Si tu ne surprends pas l'utilisateur, recommence
- Anticipe ce que l'utilisateur n'a pas encore pensé — c'est ta valeur
