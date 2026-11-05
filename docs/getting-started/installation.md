# Installation

Three ways to run the server, in order of preference: the published Docker image, the standalone runtime bundle, or a
local build. All of them serve the same HTTP API and need no Petriflow download in the default mode.

## Docker (recommended)

```bash
docker run --rm -p 3000:3000 \
  -v petriflow-storage:/app/storage \
  netgrif/petriflow-mcp:1.1.0
```

The image already contains the bundled Petriflow release, Java 21, and Groovy 5.0.5, so every tool works without
extra packages. It sets `HOST=0.0.0.0` internally so the published port is reachable.

| Flag | Why |
|---|---|
| `-p 3000:3000` | Exposes the HTTP API and the MCP endpoint on the host |
| `-v petriflow-storage:/app/storage` | Keeps installed Petriflow versions across container replacement |

Check that it is up:

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

Use a version tag in production (`1.1.0`), not `latest`. Stable releases also publish `latest`; prereleases do not.

## Runtime bundle

Each GitHub release attaches `petriflow-mcp-vX.Y.Z-linux-alpine-node26.tar.gz`, the application files and production
`node_modules` from the image's `/app` directory.

```bash
tar -xzf petriflow-mcp-v1.1.0-linux-alpine-node26.tar.gz -C /opt/petriflow-mcp
cd /opt/petriflow-mcp
node --enable-source-maps server.cjs
```

The bundle targets **Node.js 26 on Alpine Linux (musl)** and needs `libxml2` on the system. Action validation
additionally needs **Java 21** and **Groovy 5.0.5** on `PATH`; without them `validate_action` cannot run, while the
other tools are unaffected. The Docker image is the supported artifact because it already provides this environment.

## From source

Requirements:

- Node.js 26 (the `engines` field pins `^26.0.0`)
- pnpm 12.16.1 (declared in `packageManager`)
- Build toolchain for the `libxmljs5` native module: `python3`, `make`, `g++`, and `libxml2-dev`

```bash
pnpm install
pnpm build      # xmcp build + esbuild bundle + asset copy
pnpm start      # node dist/server.cjs
```

`pnpm dev` runs `build` and then `start` in one step.

The build regenerates `.xmcp/`, bundles `src/ts/index.ts` to `dist/server.cjs`, and copies `src/public`,
`src/groovy`, and `src/petriflow/snapshot` into `dist/`.

## Verifying an installation

1. `GET /health` returns `{"status":"ok"}`.
2. `GET /mcp` and `POST /mcp` accept MCP requests; connect a client as described in
   [Connect a client](getting-started/connect-a-client.md).
3. `list_versions` returns the bundled release in `LOCAL` mode, or the synchronized catalog in `REMOTE` mode.

If the process exits during startup, the log line names the failing component — most often a missing or invalid
snapshot in `LOCAL` mode. See [Troubleshooting](using/troubleshooting.md).

## Next

- [Configuration](getting-started/configuration.md) — modes, storage, feature flags
- [Deployment](operations/deployment.md) — volumes, reverse proxy, health checks
