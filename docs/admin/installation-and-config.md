# Installation and configuration

## Requirements

- Node.js **22.12.0 or newer** and pnpm.
- To build the native `libxmljs2` dependency from source: Python 3, `make`, `g++`, and `libxml2` development headers.
- To use `validate-action` or the action-validation semantic rule: a JVM (OpenJDK 21) and Groovy 4.0.x on `PATH`.

The production bundle externalizes `libxmljs2`; the runtime image must include `node_modules` and the native library.
The action-validation service also needs the Groovy validator files from `src/groovy`.

## Build and run

```bash
pnpm install
pnpm build
pnpm start
```

`pnpm dev` builds and then starts the server. The default HTTP port is `3000`.

## Environment variables

| Variable    | Default | Purpose                 |
|-------------|--------:|-------------------------|
| `PORT`      |  `3000` | Fastify listening port. |
| `HOST`      | `127.0.0.1` | Bind address. The Docker image sets `0.0.0.0` so published container ports are reachable. |
| `LOG_LEVEL` |  `info` | Fastify/Pino log level. |

The application does not authenticate the sync endpoint. Protect it at the deployment ingress or reverse proxy.

## Docker status

The Dockerfile uses Corepack and the repository's pnpm lockfile with `--frozen-lockfile`. It pins the same Node 22.23.3/Alpine 3.24 image digest for build and runtime, verifies the Groovy 4.0.33 archive checksum, and sets `HOST=0.0.0.0` so published container ports work.

The runtime image declares `/app/dist/storage` as a volume. Configure a named volume at that path to preserve synchronized releases when containers are replaced. The server also writes the recreatable version cache to `/app/dist/cache.json`.

The Node base image, pnpm dependency graph, and Groovy archive are pinned. `apk add` still uses Alpine repositories during builds, so identical OS package versions are not guaranteed indefinitely; use a repository snapshot or exact package pins if byte-for-byte image reproducibility is required, and keep those pins updated for security fixes.
