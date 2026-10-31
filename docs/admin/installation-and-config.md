# Installation and configuration

## Requirements

- Node.js **26.x** and pnpm.
- To build the native `libxmljs5` dependency from source: Python 3, `make`, `g++`, and `libxml2` development headers.
- To use `validate-action` or the action-validation semantic rule: a JVM (OpenJDK 21) and Groovy 4.0.x on `PATH`.

The production bundle externalizes `libxmljs5`; the runtime image must include `node_modules` and the native library.
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
| `PETRIFLOW_MODE` | `REMOTE` | `REMOTE` synchronizes releases from GitHub; `LOCAL` uses the bundled snapshot and does not contact GitHub. |

The bundled LOCAL snapshot source is `src/petriflow/snapshot/`; `pnpm build` copies it to `dist/petriflow/snapshot/`.
The current snapshot is SemVer `1.0.9`; its version and release date are recorded in `manifest.json`. To refresh it,
replace the files with a complete, verified Petriflow release dataset and update `manifest.json` with its SemVer and
published date (or leave the date empty when the source does not provide one). The snapshot must contain
`petriflow.schema.xsd`, `overview.md`,
`actions-definitions.json`, at least one `elements/*.xsd`, and at least one `examples/*.xml`. The build and server never
download snapshot data. A missing or invalid snapshot prevents startup in LOCAL mode.

The application does not authenticate the sync endpoint. Protect it at the deployment ingress or reverse proxy.

## Docker status

The Dockerfile uses Corepack and the repository's pnpm lockfile with `--frozen-lockfile`. It uses the Node 26/Alpine 3.24 image tag for build and runtime, verifies the Groovy 4.0.33 archive checksum, and sets `HOST=0.0.0.0` so published container ports work.

The runtime image declares `/app/dist/storage` as a volume. Configure a named volume at that path to preserve synchronized releases when containers are replaced. The server also writes the recreatable version cache to `/app/dist/cache.json`.

The Node 26 major and Alpine 3.24 line are fixed, while the Node patch follows the image tag; the pnpm dependency graph and Groovy archive are pinned. `apk add` still uses Alpine repositories during builds, so identical OS package versions are not guaranteed indefinitely; use a repository snapshot or exact package pins if byte-for-byte image reproducibility is required, and keep those pins updated for security fixes.
