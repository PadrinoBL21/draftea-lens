# Multi-Server Strategy

Draftea Lens supports multiple deployment targets, but only one server should write production-like data until synchronization and deduplication are formalized.

Initial roles:

- `aws-main`: primary remote deployment.
- `royalserver-lab`: secondary lab/backup deployment.

Safety rules:

- Do not enable real staking in Docker.
- Do not enable schedulers on multiple servers at the same time.
- Runtime data is persisted in a Docker volume.
- Use `SERVER_ID` and `SERVER_ROLE` to identify data origin.
- Keep separate `.env` files per server.

Default write policy:

```text
AWS = primary writer
RoyalServer = secondary / lab / read-only collector disabled
```
