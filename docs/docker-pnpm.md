# Docker + pnpm

Docker builds use pnpm through Corepack.

Dockerfile commands such as `RUN corepack enable` belong inside Dockerfiles, not in the server shell.

Local first-time setup:

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
```

Docker builds then use:

```bash
pnpm install --frozen-lockfile
```

Commit `pnpm-lock.yaml` so Docker builds are reproducible.
