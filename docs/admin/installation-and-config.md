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
| `LOG_LEVEL` |  `info` | Fastify/Pino log level. |

The application does not authenticate the sync endpoint. Protect it at the deployment ingress or reverse proxy.

## Docker status

The current Dockerfile uses `npm install`, while the project is managed with pnpm and has no npm lockfile. Treat the
Docker build as unsynchronized and non-reproducible until the package-manager mismatch is resolved; use the documented
pnpm commands for local setup.
