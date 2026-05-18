# Déploiement — {{name}}

> Slug : `{{slug}}` · Statut : `{{status}}`

## Cible

- **URL** : {{deploy_url_or_no_deploy}}
- **VPS** : `83.228.221.188` (Batiscan), reverse proxy Caddy + basic auth
- **Container Docker** : {{container_or_dash}}
- **Réseau Docker** : `batiscan-v4_batiscan-network`

## Build & deploy

Pattern habituel sur le VPS Batiscan :

```bash
# 1. SSH au VPS
ssh -i ~/.ssh/id_ed25519_batiscan_vps ubuntu@83.228.221.188

# 2. Cloner ou pull
cd /home/ubuntu/{{slug}}
git pull origin main

# 3. Rebuild container
docker compose up -d --build

# 4. Vérifier les logs
docker logs {{container_or_dash}} --tail 30
```

## Caddyfile

Le bloc de routage est dans `/home/ubuntu/Batiscan-V4/Caddyfile` (bind-monté dans le container `batiscan_caddy`).

**Important** : pour modifier le Caddyfile, jamais `cp` — utiliser `tee` pour préserver l'inode du bind mount, puis `docker restart batiscan_caddy`. Cf. mémoire `caddyfile-bind-mount-trap.md`.

## Secrets

Tous dans Bitwarden. Le `.env` du service vit en clair sur le VPS sous `chmod 600`.

## Rollback

<!-- À compléter : tag git, image Docker précédente, etc. -->

## Monitoring

- Uptime : https://uptime.robinetclaude.ch (basic auth)
- Logs container : `docker logs {{container_or_dash}}`
- Health VPS global : `GET https://robinetclaude.ch/api/state`
