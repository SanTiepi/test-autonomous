---
name: bye
description: "Termine la session Claude proprement : produit un handoff structuré pour la prochaine instance Claude, le pousse vers studio-api /api/handoff/<slug>, propose le commit/push. Usage : /bye"
user-invocable: true
---

# /bye — Fin de session avec handoff structuré

Quand Robin tape `/bye`, tu termines la session **proprement** pour que la prochaine instance Claude qui ouvre ce projet reprenne sans réexplication.

## Étape 1 — Identifier le projet

Détecte le slug du projet courant depuis :
- Le `CLAUDE.md` à la racine du repo (chercher slug dans Studio Robin section)
- Ou le nom du repo git (`git remote get-url origin` → extraire le nom)
- Ou le nom du dossier parent

Slug attendu : minuscule, tirets (ex: `batiscan-v4`, `cortex`, `justicepourtous`).

## Étape 2 — Composer le handoff

Construis un JSON structuré qui condense la session pour le prochain Claude :

```json
{
  "what_done": ["fix bug X dans Y.mjs", "ajouté tests Z (3 cas)", "refactor X cleanup"],
  "what_works": "Tests verts (npm test ok 245/245). Le module Z gère maintenant les cas null correctement.",
  "what_breaks": "Test 'flow XYZ' flake — passe 9/10 fois (race condition probable). À investiguer.",
  "decisions": ["Choix archi : on garde X au lieu de Y parce que Z (cf discussion avec Robin)"],
  "blockers": "Attente Robin sur la doctrine du module W avant d'implémenter la suite.",
  "next_step": "Au prochain démarrage : reprendre sur le test flake (fichier test/abc.test.js ligne 42), creuser la race.",
  "context_for_next_claude": "Robin pivote vite sur ce sujet — vérifier au /salut s'il a changé d'avis avant de continuer la direction. Le repo a un sous-dossier `experiments/` à ignorer.",
  "tags": ["bug", "tests", "race-condition"]
}
```

`tags[]` est optionnel mais **fortement recommandé** : 1-5 mots-clés courts en kebab-case (ex: `infra`, `ui`, `memory`, `cortex`, `migration`, `flake`, `bug`, `refactor`). Permettent de filtrer dans `/api/handoffs/search?tag=X` et dans la page `/search.html`.

**Tu n'as PAS besoin d'inclure `interim_notes` dans le body** : le serveur ramasse automatiquement les notes posées via `/note` depuis le dernier handoff. Si tu veux explicitement zapper ce comportement, passe `"interim_notes": []`.

Règles de composition :
- `what_done` : faits objectifs, pas autosatisfaction (pas "j'ai bien bossé sur X" — juste "X fait")
- `what_works` : ce qui est VÉRIFIÉ (tests verts, déploiement OK), pas supposé
- `what_breaks` : honnête, ne pas cacher les bugs sous le tapis
- `decisions` : structurantes, pas opérationnelles (pas "j'ai renommé une variable" — oui "on a tranché sur l'archi X")
- `next_step` : actionnable, pas vague ("reprendre X" → préciser où, comment)
- `context_for_next_claude` : ce qu'il faut savoir pour pas refaire les erreurs de cette session

## Étape 3 — Présenter à Robin pour validation

Affiche le handoff proposé en clair. Demande :
> "Voici le handoff que je vais pousser pour la prochaine instance Claude. Tu valides, tu corriges, ou tu veux ajouter quelque chose ?"

**Anti-narration** : ne JAMAIS push sans validation Robin explicite. Robin doit dire "ok" ou modifier.

## Étape 4 — Push vers studio-api

Une fois validé par Robin, POST vers `https://robinetclaude.ch/api/handoff/<slug>`.

**Récupération du token X-Studio-Token** (par ordre de préférence) :
1. `C:\PROJET IA\studio-portfolio\.env` (clé `STUDIO_API_TOKEN`) — présent si la machine de Robin a le repo studio-portfolio cloné
2. À défaut : SSH au VPS : `ssh -i ~/.ssh/id_ed25519_batiscan_vps ubuntu@83.228.221.188 'grep STUDIO_API_TOKEN /home/ubuntu/studio-api/.env | cut -d= -f2'`

**Récupération du basic auth password robinetclaude.ch** :
1. Via Bitwarden CLI (wrapper) : `& "W:\BATISCAN_SETUP_BUREAU\BATISCAN_SETUP_BUREAU\bitwarden\bw-auto.ps1" get "robinetclaude.ch"` — cf. CLAUDE.md global pour les fallbacks de path et le setup multi-machines
2. Si le wrapper n'est pas disponible sur cette machine (W: pas monté et fallback kDrive vide) → demander à Robin **une fois** ; il pourra coller le pwd dans `.env` local sous `STUDIO_BASIC_PWD` pour les sessions suivantes
3. **Bypass possible** depuis la machine de Robin si configurée pour SSH au VPS : POST direct vers le réseau interne via `docker exec batiscan_caddy wget ... http://studio-api:3001/...` — pas de basic auth requis. Exemple :
   ```bash
   ssh -i ~/.ssh/id_ed25519_batiscan_vps ubuntu@83.228.221.188 \
     "docker exec batiscan_caddy wget -qO- \
        --header='X-Studio-Token: $TOKEN' \
        --header='Content-Type: application/json' \
        --post-data='<json>' \
        http://studio-api:3001/api/handoff/<slug>"
   ```

**POST classique via HTTPS** (basic auth requise) :

```bash
curl -u "robin:$BASIC_PWD" \
  -H "X-Studio-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"what_done": [...], "next_step": "...", ...}' \
  https://robinetclaude.ch/api/handoff/<slug>
```

Réponse attendue : `{ ok: true, slug, ts, path }`.

**Validation slug** : le format slug accepté par l'API est `[a-z0-9-]+` (minuscule, chiffres, tirets uniquement). `_` ou majuscules → 400.

## Étape 5 — Autres actions de fin de session

Selon le projet courant :

- **Repo avec `.claude/memory/`** : proposer un commit + push si modifs mémoire (anti-narration, valider chaque diff avec Robin).
- **Repo Batiscan-V4** : invoquer `/batiscan-handoff` en plus.
- **Studio-portfolio** : invoquer `/studio-update <slug> <résumé>` pour ajouter une ligne à la fiche du carnet.
- **Tests verts** : confirmer une dernière fois avant de fermer.

## Étape 6 — Au revoir

Confirme à Robin :
> "✓ Handoff posté pour `<slug>` à `<ts>`. Au revoir, à la prochaine session !"

## Cas spéciaux

### Session courte ou triviale
Si la session n'a rien produit de notable (juste lecture, ou test rapide qui marche), demande à Robin :
> "Cette session n'a rien produit de structurant. Tu veux quand même un handoff (juste pour la trace) ou on skip ?"

### Erreur API
Si POST échoue (token invalide, slug inconnu, etc.) → fallback : écrire localement dans `~/.claude/projects/c--PROJET-IA-<repo>/memory/HISTORY.md` une section "Handoff non posté — à pousser manuellement plus tard".

### Slug introuvable
L'API n'exige PAS que le slug existe dans `projects.base.json` — elle accepte tout slug matchant `[a-z0-9-]+`. Si le projet n'a pas de fiche carnet, propose à Robin :
> "Pas de fiche carnet pour `<slug>`. Tu veux que je la crée via `/studio-update` ou on push le handoff sans fiche ?"

## Liens avec /salut

La skill `/salut` (entrée de session) lit le dernier handoff via `GET /api/handoff/<slug>/latest` et le présente à Claude au démarrage. C'est le pendant entrée/sortie.
