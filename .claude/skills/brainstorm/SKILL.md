---
name: brainstorm
description: "Swarm Brainstorm V3 — multi-agent emergence, inspiré MiroFish. Usage: /brainstorm <idée>. Spawn → Interact → Extract."
user-invocable: true
---

# /brainstorm — Swarm V3

L'insight ne vient pas de 2 cerveaux qui donnent leur avis.
Il émerge d'un **essaim d'agents qui interagissent, changent d'avis, et forment des patterns** qu'aucun agent seul n'aurait trouvé.

Inspiré de [MiroFish](https://github.com/666ghj/MiroFish) : GraphRAG + agents hétérogènes + mémoire persistante + ReportAgent observateur.

---

## Intensité (auto-détectée)

| Signal | Intensité | Essaim | Rounds |
|--------|-----------|--------|--------|
| Question claire, scope réduit | **Light** | 4 agents | 1 round |
| Feature, architecture, stratégie | **Medium** | 6 agents | 2 rounds |
| Produit, pivot, vision, "deep"/"fractal" | **Full** | 8-10 agents | 3 rounds + kill gate + web search |

---

## Phase 0 — GROUND (le terreau)

Avant de spawner quoi que ce soit, ancrer l'essaim dans le réel.

1. **Le problème en 2 phrases.** Pas la solution. La douleur.
2. **Le contexte Robin.** Assets existants, projets liés, décisions passées (mémoire + TASKS.md).
3. **Web search rapide.** Qui fait déjà ça ? Quel marché ? Quels signaux ? (intensité Medium+)

Ce contexte est le **knowledge graph** de l'essaim. Chaque agent le reçoit. Sans ça, les agents halluucinent.

---

## Phase 1 — SPAWN (l'essaim)

Chaque agent est défini par un **prompt précis** avec 4 éléments obligatoires :

```
NOM: [archétype vivant, pas "Expert 1"]
BIAIS: [sa lentille déformante — explicite, assumée]
MÉMOIRE: [1 fait spécifique du contexte Robin qu'il connaît]
MOTIVATION: [ce qu'il VEUT — pas ce qu'il sait, ce qu'il cherche à prouver]
```

La motivation est clé. Un agent sans motivation donne un avis. Un agent avec une motivation **se bat** pour une position — et c'est le combat qui crée l'émergence.

### Composition

| Slot | Archétype | Prompt-clé |
|------|-----------|------------|
| 1 | **Le praticien** | Expert terrain du domaine. Biais : "ce qui marche aujourd'hui". Motivation : prouver que la solution simple suffit. |
| 2 | **Le visionnaire** | Voit 5 ans devant. Biais : "le futur sera radicalement différent". Motivation : prouver que le statu quo est un piège. |
| 3 | **L'adjacent** | Expert d'un domaine voisin. Biais : "mon domaine a déjà résolu ça". Motivation : importer un mécanisme. |
| 4 | **L'alien** | Expert d'un domaine sans rapport (biologie, musique, sport, cuisine, jeux vidéo, architecture...). Biais : "les mêmes patterns se répètent partout". Motivation : trouver l'isomorphisme caché. |
| 5 | **Le client** | L'utilisateur final qui paierait. Biais : "je m'en fous de l'élégance, est-ce que ça résout MON problème ?". Motivation : payer le moins possible pour le max de valeur. |
| 6 | **Le destructeur** | Veut TUER l'idée. Biais : "90% des projets échouent". Motivation : trouver la faille fatale. |
| 7 | **L'investisseur** (Medium+) | Pense retour, traction, scalabilité. Biais : "montre-moi les chiffres". Motivation : trouver le wedge. |
| 8 | **Le régulateur** (Full) | Pense risques, lois, éthique, conséquences 2ème ordre. Biais : "qu'est-ce qui peut mal tourner pour la société ?". Motivation : protéger. |

**Light** : slots 1, 4, 5, 6 (4 agents)
**Medium** : slots 1-6 (6 agents)
**Full** : slots 1-8 + 1-2 agents custom adaptés au sujet (8-10 agents)

### Exécution

Lancer **3 sub-agents en parallèle** via l'outil Agent. Chaque sub-agent joue 2-3 personas.

**Prompt sub-agent (template) :**
```
Tu incarnes [N] personnages dans un brainstorm. Pour chacun :

CONTEXTE COMMUN:
[Le problème en 2 phrases]
[Les données terrain : marché, concurrents, assets Robin]

PERSONNAGE 1 — [NOM]
Biais: [biais]
Mémoire: [1 fait spécifique]
Motivation: [ce qu'il veut prouver]

PERSONNAGE 2 — [NOM]
[...]

Pour CHAQUE personnage, produis :
1. RÉACTION INITIALE au sujet (2 lignes max — viscérale, pas analytique)
2. PROPOSITION (3 lignes max — le mécanisme concret qu'il défend)
3. ATTAQUE de la proposition du personnage précédent (1 ligne — pourquoi c'est naïf/dangereux/insuffisant)

Sois en PERSONNAGE. Pas neutre. Pas diplomate. Chaque agent pousse sa position.
```

---

## Phase 2 — INTERACT (les collisions)

C'est ICI que la valeur se crée. Pas les opinions — les **réactions en chaîne**.

### Round 1 — Provocation croisée

Prendre les **3 paires les plus éloignées** (alien×praticien, destructeur×visionnaire, client×régulateur).

Pour chaque paire, un sub-agent joue l'interaction :

```
[AGENT A] a dit : "[sa proposition]"
[AGENT B] a dit : "[sa proposition]"

Tu es maintenant AGENT A. Tu lis ce que B a dit.
- Est-ce que ça change ta position ? (oui/non + pourquoi en 1 ligne)
- Quelle NOUVELLE idée émerge de la collision de vos deux positions ? (2 lignes)

Puis tu es AGENT B. Même exercice.
```

**Le changement d'avis EST le signal.** Si un agent change de position après avoir lu un autre → c'est une étincelle. Si personne ne bouge → le sujet est mort ou trop consensuel.

### Round 2 — Cascade (Medium+)

Les 2 meilleures étincelles du Round 1 sont postées devant TOUT l'essaim.

Chaque agent réagit avec UN MOT + 1 ligne :
- 🔥 **Amplifie** — "oui et en plus..." (1 ligne)
- 💀 **Tue** — "ça foirera parce que..." (1 ligne)
- 🔀 **Pivote** — "non mais si on prenait ça sous l'angle..." (1 ligne)
- 🤝 **Rallie** — change de camp (1 ligne sur pourquoi)

**Patterns à détecter :**
- Unanimité 🔥 → **suspect.** Consensus = biais de groupe. Creuser.
- Split 🔥/💀 → **intéressant.** Désaccord = signal d'opportunité.
- Cascade 🤝 → **fort.** Quand un agent retourne d'autres agents, c'est un mouvement réel.
- Tout 💀 → **kill.** L'essaim a parlé.

### Round 3 — Stress test (Full)

L'étincelle survivante passe 3 tests en parallèle :

| Test | Agent | Méthode |
|------|-------|---------|
| **Réalité** | Web search | Qui fait ça ? Marché ? Timing ? |
| **Destruction** | Codex (background) | Template destructeur ci-dessous |
| **Terrain** | Le client (slot 5) | "Je paierais combien pour ça ? Je l'utiliserais comment ? Je le trouverais où ?" |

**Template Codex destructeur :**
```
SUJET: {sujet}
ÉTINCELLE SURVIVANTE: {l'idée émergente en 5 lignes}
CONTEXTE: {résumé du terreau + assets Robin}

1. KILL_REASON — La raison #1 d'échec (2 lignes)
2. SAVE_IF — La seule chose qui sauverait cette idée (1 ligne)
3. ANGLE_MORT_COLLECTIF — Ce que l'essaim entier n'a pas vu (3 lignes)
4. QUESTION_TERRAIN — La question à poser à 1 vrai humain pour trancher (1 ligne)
250 mots max. Brutal. Pas poli.
```

---

## Phase 3 — EXTRACT (le ReportAgent)

**Séparation stricte : celui qui analyse ne participe PAS.**

Claude redevient observateur. Il ne défend aucune position. Il extrait 5 choses :

1. **L'étincelle émergente** — L'idée qui n'existait dans la tête d'AUCUN agent au départ mais qui est née de leurs collisions. (3 lignes max)

2. **Le consensus inattendu** — Sur quoi des agents opposés (destructeur×visionnaire, client×alien) sont tombés d'accord ? C'est souvent là qu'est la vérité. (1 ligne)

3. **Le désaccord fertile** — Où le split est le plus net ? Le désaccord n'est pas un problème — c'est la CARTE de l'opportunité. (1 ligne)

4. **La cascade** — Quel agent a retourné les autres ? Par quel argument ? Ce mouvement révèle le vrai levier. (1 ligne)

5. **Le kill signal** — Si le destructeur ET le client sont 💀 → KILL. Pas de négociation. (1 ligne)

### Output final — 1 page max

```
════════════════════════════════════
SWARM REPORT — [titre]
════════════════════════════════════

ESSAIM: [noms + archétypes, 1 ligne]
ROUNDS: [nb] | CHANGEMENTS DE CAMP: [nb]

ÉTINCELLE ÉMERGENTE:
[3 lignes — l'idée née des collisions]

CONSENSUS INATTENDU: [1 ligne]
DÉSACCORD FERTILE: [1 ligne]
CASCADE: [quel agent a retourné qui, par quel argument]
KILL SIGNAL: [oui/non]

SCORE:
  Marché     [x/5] — [justification 5 mots]
  MVP        [x/5] — [justification 5 mots]
  Porteur    [x/5] — [justification 5 mots]
  Timing     [x/5] — [justification 5 mots]
  TOTAL      [x/20]

VERDICT: [go / creuse X / kill]
PREMIER MOVE: [1 action concrète, pas une vision]
QUESTION TERRAIN: [la question à poser à 1 vrai humain]
════════════════════════════════════
```

---

## Kill gate (permanent)

Applicable à **n'importe quel moment**, pas qu'au début.

| Test | Seuil | Action |
|------|-------|--------|
| 3+ concurrents bien financés, pas de différenciateur | Immédiat | KILL |
| Le client (slot 5) dit "je paierais pas" | Immédiat | KILL |
| Score < 14/20 | Après extract | KILL |
| Tout l'essaim vote 💀 au Round 2 | Immédiat | KILL |

Un kill n'est pas un échec. C'est une victoire de vitesse.

---

## Scoring

| Critère | /5 | Signal |
|---------|-----|--------|
| Marché | /5 | Taille, douleur mesurable, gens qui cherchent |
| Faisabilité MVP | /5 | Constructible en 1 semaine avec briques existantes ? |
| Trouvabilité porteur | /5 | Quelqu'un de passionné porterait ça ? Facile à pitcher ? |
| Timing | /5 | Fenêtre ouverte MAINTENANT ? Pas dans 2 ans. |

< 14 → KILL. 14-16 → BEST.md. > 16 → Go si Robin valide.

---

## Après chaque brainstorm

### Log (`.claude/brainstorm_log.md`)
```
- [date] [intensité] [résultat] [titre] — [l'étincelle émergente en 1 ligne]
```

### Kills
```
- [date] [KILLED] [titre] — [qui dans l'essaim a tué + pourquoi]
```

### BEST.md
Score ≥ 16/20 → `docs/idea-lab/BEST.md` avec le swarm report complet.

---

## Principes

- **L'émergence > l'expertise.** L'insight naît de la collision, pas de l'opinion.
- **Le changement d'avis EST le signal.** Un agent qui retourne sa position révèle un levier caché.
- **Le désaccord EST la carte.** Unanimité = biais de groupe. Split = opportunité.
- **Participant ≠ observateur.** Celui qui analyse ne joue pas.
- **Mémoire obligatoire.** Chaque agent connaît 1 fait du contexte Robin. Pas de simulation à vide.
- **Kill fast, kill permanent.** Idée tuée = énergie libérée.
- **Problème > solution.** Toujours la douleur d'abord.
- **5 lignes max par idée.** Si c'est pas clair en 5, c'est pas clair.
- **1 page max en sortie.** Toujours.
- **1 vrai humain > 100 agents simulés.** L'essaim ouvre les portes, l'humain les franchit.
- **Si tu ne surprends pas Robin, recommence.**
