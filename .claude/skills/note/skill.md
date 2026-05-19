---
name: note
description: "Pose un marqueur intermédiaire dans la session courante. Le texte est appendé à un buffer côté studio-api (notes/<slug>.jsonl) qui sera AUTOMATIQUEMENT consommé au prochain /bye et intégré au handoff sous interim_notes[]. Utile pour ne pas perdre une observation si on oublie le /bye. Usage : /note <texte libre>"
user-invocable: true
---

# /note — Marqueurs intermédiaires en cours de session

Quand Robin tape `/note <texte>` (ou que toi-même tu veux poser un marqueur sans interrompre Robin), tu envoies ce texte vers `POST /api/notes/<slug>` du studio-api.

Les notes s'accumulent côté serveur dans `notes/<slug>.jsonl` (append-only). Au prochain `/bye` :
1. La skill `/bye` GET `/api/notes/<slug>` pour récupérer les notes posées depuis le dernier handoff
2. Elle les intègre automatiquement dans le payload sous `interim_notes[]`
3. Après POST handoff réussi, la skill `/bye` appelle DELETE `/api/notes/<slug>` pour vider le buffer

**Effet** : même si Robin oublie `/bye`, les marqueurs intermédiaires sont préservés jusqu'à la session suivante (juste pas encore consolidés en handoff).

## Étape 1 — Identifier le slug

Comme `/bye` et `/salut` : depuis `CLAUDE.md`, `git remote`, ou dossier parent.

## Étape 2 — POST la note

```bash
TOKEN=$(grep STUDIO_API_TOKEN c:/PROJET\ IA/studio-portfolio/.env | cut -d= -f2)
# Ou via bw-auto si .env pas dispo

curl -u "robin:$BASIC_PWD" \
  -H "X-Studio-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"text": "<note>", "kind": "observation|decision|todo|hypothesis"}' \
  https://robinetclaude.ch/api/notes/<slug>
```

`kind` est optionnel, défaut = `observation`. Valeurs utiles :
- `observation` : truc remarqué pendant la session
- `decision` : choix structurant tranché à ce moment
- `todo` : item identifié comme à faire (mais pas fait là tout de suite)
- `hypothesis` : intuition à vérifier plus tard

## Étape 3 — Confirmer brièvement

> "✓ Note ajoutée (<kind>). Sera intégrée au prochain `/bye`."

Pas d'affichage long. C'est un marqueur, pas une cérémonie.

## Cas spéciaux

### Texte vide
Refuse poliment : "Tu voulais noter quoi ?"

### API injoignable
Fallback : écrire localement dans `~/.claude/projects/c--PROJET-IA-<repo>/memory/notes-buffer.md` avec timestamp. Mentionner à Robin : "API injoignable, noté localement. Sera à syncer manuellement."

### Slug introuvable
Demande à Robin (comme `/bye`).

## Auto-usage (sans que Robin tape `/note`)

**Tu peux poser des notes toi-même** quand tu remarques un truc qui mérite d'être tracé pour la prochaine session, MAIS pas urgent au point de blocker. Par exemple :

- En lisant le code tu réalises : "ce module utilise encore l'ancien pattern, à migrer" → `kind: todo`
- Tu tranches un détail technique : "j'ai choisi X au lieu de Y parce que Z" → `kind: decision`
- Tu vois un bug latent : "ce regex va casser sur les inputs UTF-8 avec emoji" → `kind: observation`

**Pas d'auto-narration** : ne note pas "j'ai cherché dans le fichier X" ou "j'ai lu la doc". Des trucs qui aident la PROCHAINE session à pas refaire ou à pas oublier.

## Lien avec /bye et /salut

```
session N
  /salut    → lit le handoff de N-1
  ...
  /note "regex en utf8 à vérifier sur build-brief.mjs"     (à H+2h)
  /note "test flake reproduit, c'est la race sur snoozes.json"    (à H+4h)
  /bye      → ramasse les 2 notes, les inclut dans interim_notes[]
              → POST handoff vers studio-api

session N+1
  /salut    → lit le handoff de N (avec interim_notes intégrées)
```
