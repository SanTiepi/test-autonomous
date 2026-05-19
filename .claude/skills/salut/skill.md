---
name: salut
description: "Démarre une session Claude proprement : lit le dernier handoff de la session précédente pour ce projet (via studio-api), le présente à Robin, puis reprend là où on s'est arrêté. Pendant de /bye. Usage : /salut"
user-invocable: true
---

# /salut — Début de session avec lecture du dernier handoff

Quand Robin tape `/salut` (ou au tout premier message de la session sur un projet), tu commences par lire le handoff de la session précédente, puis tu reprends le travail là où la précédente Claude s'est arrêtée.

C'est le **pendant entrée** de `/bye` — sans `/salut`, on perd la mémoire entre sessions.

## Étape 1 — Identifier le projet (résolution stricte)

**Le nom du dossier ne suffit PAS** : certains repos ont un dossier ≠ slug (ex: `JusticeBot/` → `justicepourtous`, `NeuralShop/` → `neuralshop-benoit`). Source de vérité : `apps.json` du studio.

**Ordre de résolution** :
1. **`GET /api/apps/by-path?path=<basename_pwd>`** — résolution canonique via le registre. Retourne `{slug, name, ...}` ou 404.
2. Champ `slug:` dans `CLAUDE.md` du repo (rare).
3. `git remote get-url origin` → extraire le nom (ex: `SanTiepi/JusticePourtous` → essayer `justicepourtous`).
4. Nom du dossier parent — fallback ultime.

Slug attendu : `[a-z0-9-]+` (minuscule, tirets).

## Étape 2 — Fetch le dernier handoff + les notes en attente

Fetch en parallèle :
- **`GET /api/handoff/<slug>/latest`** — le dernier handoff posé via `/bye`
- **`GET /api/notes/<slug>`** — les notes intermédiaires posées via `/note` depuis ce dernier handoff (= notes en attente d'ingestion)

Les deux donnent une image complète : le handoff = "ce qu'on avait pensé à la fin", les notes = "ce qui s'est ajouté depuis sans recap formel" (sessions interrompues, observations cross-session, warnings d'autres Claudes).

Auth :
- Basic auth (`robin:<password>`) — récupérer le password depuis Bitwarden si le wrapper `bw-auto.ps1` est disponible (cf. CLAUDE.md global), sinon depuis `.env` local (`STUDIO_BASIC_PWD` ou équivalent), sinon demander à Robin **une fois** dans la session
- Pas besoin de `X-Studio-Token` pour le GET

Exemple :

```bash
# Handoff
curl -s -u "robin:$BASIC_PWD" https://robinetclaude.ch/api/handoff/<slug>/latest
# Notes en attente (depuis le dernier handoff)
curl -s -u "robin:$BASIC_PWD" https://robinetclaude.ch/api/notes/<slug>
```

Réponses possibles pour le handoff :
- `200` avec JSON du handoff → étape 3
- `404 { "error": "no handoff yet" }` → première session, dis-le simplement à Robin et démarre normalement
- Network/timeout → fallback : chercher localement dans `~/.claude/projects/c--PROJET-IA-<repo>/memory/HISTORY.md` si présent

Pour les notes : `200 { count, notes[] }` — peut être vide (`count: 0`), normal.

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

**Si des notes en attente sont présentes** (count > 0), ajoute une section après le handoff :

```
📌 Notes intermédiaires depuis ce handoff (<count>)
• [<kind>] <text>  (posée il y a <âge>)
• ...
```

Ces notes sont des marqueurs posés au fil de l'eau (par toi, par Robin, ou par une autre session Claude). Elles peuvent CONTREDIRE le handoff (ex: "le next_step est périmé, voici pourquoi"). Lis-les AVANT de proposer la reprise.

Puis demande à Robin :
> "On reprend sur <next_step en 1 ligne> ou tu veux pivoter ?"

## Étape 4 — Preflight (à exécuter AVANT de présenter le handoff)

Avant de balancer le handoff brut, lance ces checks en parallèle pour donner à Robin une vraie photo de l'écart entre "ce qu'on disait" et "ce qui est". Format des résultats dans le bullet point "État courant" du résumé.

### Checks à faire en parallèle (1 message avec plusieurs tool calls)

1. **Git** :
   - `git log -1 --format='%h %ar — %s'` → dernier commit (sha + il y a X + message)
   - `git status --short` → modifs non commit en attente
   - Si le repo a un upstream : `git log @{u}.. --oneline` → commits non poussés
   - `git log <handoff_ts>..HEAD --oneline | head -10` → ce qui a été commit DEPUIS le handoff

2. **Existence des fichiers cités dans next_step** :
   - Si `next_step` mentionne un path (regex `[a-zA-Z0-9_\-/.]+\.[a-z]+`), vérifier `Test-Path` / `ls`
   - Si introuvable → drapeau "fichier mentionné disparu" dans la présentation

3. **Container state** (si le projet a un container) :
   - Lire `apps.json` localement → si `container != null` → `GET https://robinetclaude.ch/api/state` (champ `health.containers[]`) et vérifier l'état
   - Si pas running → drapeau ⚠

4. **Tests** (si applicable) :
   - Si `package.json` présent et contient un script `test` : NE PAS lancer automatiquement (peut être lent). Juste signaler : "tests dispo, lance `npm test` si tu veux".
   - Pour les repos avec `pytest` / `cargo test` / etc : pareil.

### Format du preflight dans la présentation

Ajoute une section "🩺 État courant" entre "Dernier handoff" et le résumé :

```
🩺 État courant
• Git : dernier commit <sha> "<msg>" il y a <âge> · <N commits depuis le handoff>
• Working tree : <propre | N fichiers modifiés non commit>
• Container <name> : <running ✓ | exited ⚠ | absent>
• Path next_step "<file>" : <existe ✓ | introuvable ⚠>
```

Si tout est OK → présenter le handoff normalement. Si écart ⚠ → le SIGNALER explicitement dans la phrase finale, par exemple :
> "Attention : 3 commits depuis le handoff (Robin a touché au code) ET le fichier mentionné en next_step n'existe plus. On vérifie ensemble avant de continuer ?"

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
