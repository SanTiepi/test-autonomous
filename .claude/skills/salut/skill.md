---
name: salut
description: "Démarre une session Claude proprement : lit le dernier handoff de la session précédente pour ce projet (via studio-api), le présente à Robin, puis reprend là où on s'est arrêté. Pendant de /bye. Usage : /salut"
user-invocable: true
---

# /salut — Début de session avec lecture du dernier handoff

Quand Robin tape `/salut` (ou au tout premier message de la session sur un projet), tu commences par lire le handoff de la session précédente, puis tu reprends le travail là où la précédente Claude s'est arrêtée.

C'est le **pendant entrée** de `/bye` — sans `/salut`, on perd la mémoire entre sessions.

## Étape 1 — Identifier le projet (slug)

Détecte le slug du projet courant depuis :
1. Un champ `slug:` dans le `CLAUDE.md` à la racine du repo
2. Le nom du repo git (`git remote get-url origin` → extraire le nom)
3. Le nom du dossier parent du `pwd` courant

Slug attendu : minuscule, tirets (ex: `batiscan-v4`, `cortex`, `studio-portfolio`, `justicepourtous`).

## Étape 2 — Fetch le dernier handoff

GET vers `https://robinetclaude.ch/api/handoff/<slug>/latest`.

Auth :
- Basic auth (`robin:<password>`) — récupérer le password depuis Bitwarden si le wrapper `bw-auto.ps1` est disponible (cf. CLAUDE.md global), sinon depuis `.env` local (`STUDIO_BASIC_PWD` ou équivalent), sinon demander à Robin **une fois** dans la session
- Pas besoin de `X-Studio-Token` pour le GET

Exemple :

```bash
curl -s -u "robin:$BASIC_PWD" \
  https://robinetclaude.ch/api/handoff/<slug>/latest
```

Réponses possibles :
- `200` avec JSON du handoff → étape 3
- `404 { "error": "no handoff yet" }` → première session, dis-le simplement à Robin et démarre normalement
- Network/timeout → fallback : chercher localement dans `~/.claude/projects/c--PROJET-IA-<repo>/memory/HISTORY.md` si présent

## Étape 3 — Présenter le handoff à Robin

**Ne dump pas le JSON brut.** Reformate en humain, concis, en français. Format suggéré :

```
👋 Reprise de session — projet <slug>
Dernier handoff : <ts relatif, ex. "il y a 14h">

• Ce qui a été fait : <what_done condensé en 2-3 puces>
• Ce qui marche : <what_works en 1 phrase>
• Ce qui casse : <what_breaks si présent, sinon skip cette ligne>
• Décisions structurantes : <decisions si présent>
• Blockers : <blockers si présent>
• Prochaine étape proposée : <next_step>
• Note pour moi : <context_for_next_claude>
```

Puis demande à Robin :
> "On reprend sur <next_step en 1 ligne> ou tu veux pivoter ?"

## Étape 4 — Vérifier que le contexte est encore valide

**Avant d'agir** sur le `next_step` proposé par l'ancienne Claude, vérifie que c'est encore pertinent :

- Git status / dernier commit : a-t-il bougé depuis le handoff ?
- Tests verts ? (rapide check)
- Le fichier/ligne mentionné en `next_step` existe-t-il toujours ?

Si quelque chose a changé entre les deux sessions (Robin a touché au repo manuellement, ou un autre process), **dis-le explicitement** avant de continuer.

## Étape 5 — Démarrer le travail

Une fois validé par Robin, attaque le `next_step`. Si Robin dit "non, on pivote sur X", lance-toi sur X et oublie le handoff (mais garde-le mentalement comme contexte historique).

## Cas spéciaux

### Pas de handoff existant
Si `/api/handoff/<slug>/latest` retourne 404, dis simplement :
> "Première session sur `<slug>` (pas de handoff précédent). Tu veux me briefer, ou je lis le repo et je te propose une direction ?"

### Slug introuvable dans le projet
Si tu ne peux pas dériver de slug fiable, demande à Robin :
> "Quel est le slug studio de ce projet ? (ex: `batiscan-v4`, `cortex`...)"

### Handoff très ancien (>7j)
Si `ts` du handoff a plus de 7 jours, ajoute un warning :
> "⚠ Ce handoff date de <X jours>. Le contexte a peut-être bougé — vérifie le git log avant de reprendre aveuglément."

### API injoignable
Si `robinetclaude.ch` ne répond pas (timeout, 5xx), fallback : lire `~/.claude/projects/c--PROJET-IA-<repo>/memory/HISTORY.md` si présent. Sinon démarre normalement, signale le souci à Robin :
> "studio-api injoignable, je démarre sans handoff. À investiguer plus tard."

## Lien avec /bye

`/salut` (entrée) lit le dernier handoff via `GET /api/handoff/<slug>/latest`.
`/bye` (sortie) en pose un nouveau via `POST /api/handoff/<slug>`.

Si Robin ouvre une session sans tu n'aies fait `/salut` mais qu'il y a un handoff récent en attente, propose-le toi-même au premier message :
> "Au fait, il y a un handoff non lu de la session précédente. Tu veux que je le lise (`/salut`) avant qu'on attaque ?"
