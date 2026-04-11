---
name: brainstorm
description: "Brainstorm adaptatif multi-agents (Fractal V2). Usage: /brainstorm <idée>. Kill fast, diverge hard, converge sharp."
user-invocable: true
---

# /brainstorm — Fractal V2

## Classifie

- **Quick** — question simple → Claude seul, 3-5 lignes
- **Standard** — feature, architecture → Codex + Claude en parallèle
- **Deep** — stratégie, business → Codex obligatoire, contraire vrai, analogie forcée
- **Explore** — innovation, nouvelles pistes → simulation multi-agents, exploration large
- **Fractal** — vision, produit, pivot → le mode complet, kill-first, personas, web search

Détecte automatiquement. Si Robin dit "fractal" → mode Fractal.

## Quick
3-5 lignes. Verdict + pourquoi + alternative.

## Standard
Codex + Claude EN PARALLÈLE (pas séquentiellement). Cadre implicite, ce qu'il empêche de voir, idée hors cadre.

## Deep
Comme Standard + contraire vrai + analogie forcée. Codex obligatoire.

## Explore

Le mode large. On explore TOUT — volontairement trop large au début pour ne rien louper.

### Principe fondamental
Ne PAS converger trop vite. Ouvrir le champ au maximum AVANT de trier. Les meilleures idées sont aux intersections les plus improbables.

### Process

**Phase 1 — Ouverture maximale**

Génère 7-10 points de vue radicalement différents. Pas des variations — des MONDES différents :
- 3 experts du sujet (mais de sous-domaines éloignés)
- 3 experts de domaines SANS RAPPORT (sciences, arts, nature, sports, cuisine, musique, médecine, justice, jeux...)
- 1-2 profils impossibles ou inventés

Chaque point de vue : 1 mécanisme transférable, 2 lignes max. Ne trie PAS encore.

**Phase 2 — Collisions**

Force des collisions par paires entre les plus ÉLOIGNÉS. 3-5 collisions.

**Phase 3 — Patterns**

Quels PATTERNS émergent ? Qu'est-ce que plusieurs experts disent sans le savoir ?

**Phase 4 — Synthèse ouverte**

3-5 insights + 2-3 directions + 1 pattern émergent. **Ne conclus PAS.** L'explore ouvre des portes.

---

## Fractal (NOUVEAU — V2)

Le mode le plus puissant. Pour les grandes décisions : nouveau produit, pivot, vision.

### Règles absolues

1. **5 lignes max par idée.** Si tu peux pas l'expliquer en 5 lignes, c'est pas clair.
2. **Kill en 30 secondes.** Si Robin dit "bof" ou "c'est un gadget" ou "ça existe déjà", c'est MORT. Pas de "mais si on reformule..."
3. **Problème d'abord.** Jamais de solution sans problème validé.
4. **Codex et Claude en parallèle.** Toujours. Dans le même message.
5. **1 page max de sortie par étape.** Tout output qui dépasse = échec de synthèse.
6. **Logger les kills.** Chaque idée tuée + la raison → brainstorm_log.md. On ne re-propose JAMAIS une idée tuée sans nouvelle info.
7. **Un vrai utilisateur > 100 simulations.** Après le fractal, le premier move est TOUJOURS "parle à un humain réel."

### Étape 0 — Le problème (5 min)

Clarifie le problème en 2 phrases. Pas de solution. Juste la douleur.

Si Robin donne directement un sujet/solution, COMMENCE PAR TUER :

### Étape 1 — Kill first (5 min)

Avant d'imaginer quoi que ce soit, 3 tests en parallèle :

**Test 1 : "Qui fait déjà ça ?"**
→ Web search brutal. Si 3+ concurrents bien financés → raison de continuer ou KILL.

**Test 2 : "Robin est-il le bon ?"**
→ Avantage Robin (terrain, expertise, assets existants) < 3/5 → KILL.

**Test 3 : "10 personnes paieraient demain ?"**
→ Si même pas 10 early adopters identifiables → KILL.

Si un test échoue → **NEXT.** Log le kill. Pas de reformulation.

### Étape 2 — Diverger (10 min)

3 agents EN PARALLÈLE dans le même message :

| Agent | Rôle | Format |
|-------|------|--------|
| **Claude** | L'inventeur | 3 directions radicalement différentes. 5 lignes chacune. |
| **Codex** | Le destructeur | Pour chaque direction, la raison #1 d'échec. |
| **Web search** | Le réel | Ce qui existe déjà, taille du marché, signaux. |

### Étape 3 — Converger (5 min)

Robin lit les 3 outputs courts. Choisit 1 direction ou "aucune, next."

Si 1 direction survit :
- Score flash : marché / faisabilité MVP (Claude+Codex) / trouvabilité porteur / timing (4 chiffres)
- Si < 16/20 → KILL
- Si ≥ 16/20 → Étape 4

**Grille de scoring (mise à jour 2026-04-07) :**
| Critère | /5 | Description |
|---------|-----|-------------|
| Marché | /5 | Taille, croissance, douleur |
| Faisabilité MVP | /5 | Claude+Codex peuvent bootstrapper en 1 semaine ? |
| Trouvabilité porteur | /5 | Quelqu'un de passionné voudra porter ce projet ? Facile à pitcher ? |
| Timing | /5 | Fenêtre d'opportunité ouverte maintenant ? |

Note : "avantage Robin" n'est PLUS un critère. Robin = usine à prototypes. L'expertise domaine vient du porteur.

### Étape 4 — Approfondir (15 min)

Seulement la direction survivante. Claude + Codex en parallèle :

**Claude creuse :**
- Comment construire (avec quelles briques existantes)
- Pour qui exactement (5 personas en 1 ligne chacun)
- Premier move concret (pas la vision — le DAY 1)

**Codex creuse :**
- Pourquoi ça va foirer (risques juridiques, techniques, marché)
- Ce que Robin ne voit pas
- La question à poser à un vrai utilisateur pour valider/invalider

**Web search :**
- Concurrents spécifiques, pricing, traction
- Projets open source réutilisables
- Réglementation applicable

Output total : **1 page max.**

### Étape 5 — Verdict (5 min)

Robin décide :
- **"Go"** → écrire le brief d'exécution (prompt Claude Code)
- **"Pas convaincu"** → noter dans BEST.md, passer au sujet suivant
- **"Creuse X"** → retour à l'étape 4 une seule fois sur l'aspect X

### Personas Express (si demandé)

Quand Robin demande des personas :
- **10-20 profils** variés et réalistes
- **1 ligne par réaction** (pas des paragraphes)
- **Couvrir les extrêmes** : le fan, le sceptique, l'exclu, le power user, le non-tech, l'adversaire
- **Extraire les insights** : qu'est-ce que les personas révèlent qu'on n'avait pas vu ?

### Cross-Fractal (si demandé)

Quand Robin dit "fractal" sur l'ensemble des projets :
- Lister les projets actifs (depuis TASKS.md)
- Pour chaque PAIRE de projets : 1 collision en 2 lignes
- Identifier les 3 croisements les plus fertiles
- Score chacun
- Proposer le croisement #1 à implémenter

---

## Protocole Codex (tous les modes sauf Quick)

### Principe : Claude pense AVANT, Codex conteste APRÈS — EN PARALLÈLE

```
1. Claude forme sa thèse (2-3 lignes)
2. Claude lance Codex en background IMMÉDIATEMENT (même message)
3. Claude continue son analyse pendant que Codex tourne
4. Quand Codex revient : intégrer les divergences
```

### Template Codex par mode

**Standard :**
```
SUJET: {sujet}
CONTEXTE: {2-5 lignes}
THÈSE CLAUDE: {2-3 lignes}

1. BLIND_SPOT — Ce que cette thèse ne voit pas (2 lignes)
2. STRONGER — Comment la rendre plus forte (2 lignes)
3. ALTERNATIVE — Approche radicalement différente (2 lignes)
300 mots max.
```

**Deep :**
```
SUJET: {sujet}
CONTEXTE: {résumé}
THÈSE CLAUDE: {position}

1. CONTRAIRE_VRAI — Quelle croyance évidente est fausse ? (2-3 lignes)
2. ANALOGIE_FORCÉE — Mécanisme d'un domaine sans rapport (2-3 lignes)
3. BLIND_SPOT — Ce que Claude ne voit pas (2-3 lignes)
4. VERDICT — 1 phrase
300 mots max.
```

**Fractal :**
```
SUJET: {sujet}
CONTEXTE: {résumé}
DIRECTIONS CLAUDE: {les 3 directions proposées, 5 lignes chacune}

Pour CHAQUE direction :
1. KILL_REASON — La raison #1 d'échec (1 ligne)
2. SAVE_IF — Ce qui sauverait cette direction (1 ligne)

Puis :
3. DIRECTION_MANQUÉE — Une 4e direction que Claude n'a pas vue (5 lignes)
4. QUESTION_UTILISATEUR — La question à poser à un vrai humain pour trancher (1 ligne)
300 mots max. Brutal. Pas poli.
```

### Règles d'exécution

- **Toujours en background** (`&`) — Claude ne bloque JAMAIS sur Codex
- **Si Codex converge avec Claude** : signal fort → le dire explicitement
- **Si Codex diverge** : c'est LÀ que la valeur est → creuser la divergence
- **Codex ne lit le repo QUE pour vérifier un fait précis**

---

## Après chaque brainstorm

### Log
`.claude/brainstorm_log.md` :
```
- [date] [mode] [résultat] [titre] — [1 ligne]
```

### Kills
Si une idée est tuée, logger :
```
- [date] [KILLED] [titre] — [raison du kill en 1 ligne]
```

### BEST.md
Si une idée score ≥ 16/20 → ajouter dans `docs/idea-lab/BEST.md`

---

## Principes

- Quick/Standard/Deep = DÉCIDER. Explore = DÉCOUVRIR. Fractal = TRANSFORMER.
- **Kill fast.** Une idée morte vite libère de l'énergie pour la bonne.
- **Problème > solution.** Toujours commencer par la douleur.
- **Court > long.** 5 lignes > 50 lignes. 1 page > 5 pages.
- **Parallèle > séquentiel.** Claude + Codex dans le même message.
- **Réel > simulé.** 1 interview utilisateur > 100 personas IA.
- **Les meilleures idées viennent des collisions les plus improbables.**
- **Si tu ne surprends pas Robin, recommence.**
