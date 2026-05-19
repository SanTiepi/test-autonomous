---
name: done
description: "Mini-handoff cle-en-main pour les sessions triviales (typo, doc, micro-fix). POST direct vers /api/handoff/<slug> avec un payload minimal : what_done = [<texte>], next_step = '(à définir au prochain /bye complet)', tag 'mini'. Usage : /done <description courte de ce qui a été fait>"
user-invocable: true
---

# /done — Mini-handoff pour session triviale

Variante allégée de `/bye` pour les sessions où on a fait UNE chose simple (typo, doc, micro-fix, rename, dep-bump) et qu'on veut pas dérouler la cérémonie complète du `/bye` (anti-narration, validation Robin, etc.).

## Quand l'utiliser

- ✅ "corrigé un typo dans README"
- ✅ "bumpé une dep, tests verts, déployé"
- ✅ "renommé une variable pour clarté"
- ✅ "ajouté un log debug que j'ai oublié de retirer la dernière fois"

## Quand NE PAS l'utiliser

- ❌ Décision structurante (utilise `/bye` complet pour traquer `decisions[]`)
- ❌ Bug fix non trivial (utilise `/bye` pour `what_breaks` + `what_works` détaillés)
- ❌ Blocker à signaler (utilise `/bye` pour `blockers`)
- ❌ Session > 30 min (probablement plus qu'un mini-truc, fais un vrai `/bye`)

## Étape 1 — Slug

Comme les autres skills handoff : `CLAUDE.md` → git remote → dossier parent.

## Étape 2 — Texte

Robin tape `/done <texte>`. Ce texte devient `what_done[0]`.

Si Robin tape juste `/done` sans texte, demande :
> "Tu as fait quoi exactement ? (1 ligne suffit)"

## Étape 3 — POST direct (sans validation Robin)

Différent de `/bye` : **pas de revue préalable**, parce que c'est trivial par construction. Le payload est minimal :

```json
{
  "what_done": ["<texte fourni>"],
  "next_step": "(à définir au prochain /bye complet — session triviale via /done)",
  "tags": ["mini"],
  "author": "claude"
}
```

POST vers `https://robinetclaude.ch/api/handoff/<slug>` (token + basic auth, comme `/bye`).

**Note auto-ingest** : si des notes ont été posées via `/note` depuis le dernier handoff, le serveur les ramasse automatiquement dans `interim_notes[]`. Donc `/done` après quelques `/note` consolide le tout.

## Étape 4 — Confirme brièvement

> "✓ Mini-handoff posté pour `<slug>`. À la prochaine."

Pas de cérémonie. Le but de `/done` c'est la vitesse.

## Cas spéciaux

### Texte trop long (> 200 chars)
Avertis : "C'est un mini-handoff, le texte est long. Tu veux plutôt faire un `/bye` complet ?"

### Slug inconnu
Comme `/bye` — propose à Robin de créer une fiche ou d'utiliser un slug existant.

### API injoignable
Fallback : écrire dans `~/.claude/projects/c--PROJET-IA-<repo>/memory/HISTORY.md` une ligne "[done non posté] <texte> <date>".

## Lien avec les autres skills

- `/done` <texte>  → mini-handoff cle-en-main
- `/note` <texte>  → marqueur intermédiaire (sera consolidé au prochain /bye)
- `/bye`           → handoff complet avec validation Robin
- `/salut`         → entrée de session (lit le dernier handoff, peu importe son type)

Tag `mini` permet de filtrer dans `/api/handoffs/search?tag=mini` ou `/search.html?tag=mini` les mini-handoffs vs les complets.
