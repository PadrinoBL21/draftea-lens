# Ubuntu Homelab Deployment

This deployment target is the RoyalServer local machine.

Before using it as a remote deployment host, make sure Ubuntu boots by default, SSH starts automatically, and Tailscale starts automatically.

Recommended values:

```env
SERVER_ID=royalserver-lab
SERVER_ROLE=secondary
API_PORT=3010
WEB_PORT=4210
COLLECTOR_ENABLED=false
SCHEDULER_ENABLED=false
REAL_STAKE_ENABLED=false
```

Keep the collector and scheduler disabled until data ownership and deduplication rules are explicit.
