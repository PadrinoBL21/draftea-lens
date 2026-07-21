# AWS Deployment

This deployment target is the remote primary server.

Recommended runtime values:

```env
SERVER_ID=aws-main
SERVER_ROLE=primary
API_PORT=3010
WEB_PORT=4210
COLLECTOR_ENABLED=false
SCHEDULER_ENABLED=false
REAL_STAKE_ENABLED=false
```

The existing parroquia stack uses Compose project `infra` and port `8081`. Do not stop, remove, prune volumes, or run compose commands inside `/var/www/parroquia-site-v2/infra` unless intentionally maintaining that app.

Deploy path:

```bash
mkdir -p ~/deployments
cd ~/deployments
git clone https://github.com/PadrinoBL21/draftea-lens.git draftea-lens
cd draftea-lens
cp .env.aws.example .env
nano .env
docker compose --env-file .env -p draftea-lens up -d --build
```

Smoke checks:

```bash
docker compose --env-file .env -p draftea-lens ps
curl -I http://localhost:4210
curl http://localhost:3010/dashboard/overview
```
