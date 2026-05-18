# Déploiement — {{name}}

> Slug : `{{slug}}` · Statut : `{{status}}`

**Pas encore déployé.** Ce projet tourne en local pour l'instant.

## Build local

```bash
# À compléter selon le projet (ex: npm install && npm run dev)
```

## Quand le déploiement arrivera

Voir la convention studio : Docker container sur VPS Batiscan + reverse proxy Caddy + sous-domaine. Au moment du premier deploy :

1. Mettre à jour `studio-portfolio/apps.json` (champs `container` + `deploy_url`).
2. Re-générer ce `DEPLOYMENT.md` avec `/init-repo {{slug}} --force` (variante "déployé").
3. Ajouter le bloc Caddyfile sur le VPS (utiliser `tee`, pas `cp` — cf. `caddyfile-bind-mount-trap.md`).
4. Ajouter le service à Uptime Kuma (`https://uptime.robinetclaude.ch`).

## Monitoring

- Health VPS global : `GET https://robinetclaude.ch/api/state`
