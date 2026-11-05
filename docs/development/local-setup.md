# Local setup

## Requirements

| Tool | Version | Why |
|---|---|---|
| Node.js | 26.x | Runtime target (`engines` pins `^26.0.0`) |
| pnpm | 12.16.1 | Declared in `packageManager`; `--frozen-lockfile` is used in CI |
| `python3`, `make`, `g++`, `libxml2-dev` | system packages | Compile the `libxmljs5` native addon |
| Java 21 + Groovy 4.0.33 | optional | Only for `validate_action` and the `action-validation` rule |

## Install and run

```bash
pnpm install
pnpm build
pnpm start
```

`pnpm dev` builds and starts in one step. The server listens on `127.0.0.1:3000`; `PETRIFLOW_MODE` is unset, so it
runs in `LOCAL` mode against the checked-in snapshot.

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | `pnpm build && pnpm start` |
| `pnpm build` | `xmcp build`, esbuild bundle, asset copy |
| `pnpm start` | `node dist/server.cjs` |
| `pnpm typecheck` | `tsc --noEmit -p tsconfig.test.json` (source and tests) |
| `pnpm test` | `vitest run` |

Build before typechecking or testing on a fresh checkout: `xmcp build` generates `.xmcp/`, and `@xmcp/adapter` resolves
to it. That is also why CI runs build first.

## What the build produces

```text
dist/
  server.cjs          # esbuild bundle, CJS, source maps
  public/             # landing page and assets
  groovy/             # action validation support
  petriflow/snapshot/ # bundled Petriflow release
  storage/            # created at runtime
  cache.json          # created at runtime
```

`build.mjs` deletes `dist` first, so a local `storage/` directory and `cache.json` are lost on every build. That is
fine for development; production keeps storage on a volume outside the build output.

## Working with the snapshot

`src/petriflow/snapshot/` is the `LOCAL` data source. It contains `manifest.json` plus the same files a release archive
carries. To refresh it:

1. Replace the files with a complete, verified Petriflow release dataset.
2. Update `version` and `releaseDate` in `manifest.json`.
3. Bump the version even when only contents changed — installed versions are immutable, and an unchanged version is
   not reinstalled.

A missing or invalid snapshot stops startup in `LOCAL` mode; there is no remote fallback.

## Running against GitHub releases

```bash
PETRIFLOW_MODE=REMOTE pnpm start
```

This requires published `petriflow-vX.Y.Z.zip` assets on `petriflow/petriflow`, which do not exist yet. For testing the
synchronization path without network access, the service accepts an injected fetcher — see
[Testing](development/testing.md).

## Useful environment

```bash
LOG_LEVEL=debug
PETRIFLOW_DISABLED_RULES=action-validation   # skip Groovy when the JVM is not installed
PORT=3001
```

## Where to change things

| Change | File |
|---|---|
| A tool | `src/ts/tools/<name>.tool.ts` |
| A resource | `src/ts/resources/` |
| A validation rule | `src/ts/services/rules/<name>.rule.ts` |
| Startup behaviour | `src/ts/index.ts`, `src/ts/services/petriflow-runtime.service.ts` |
| Release sync | `src/ts/services/release-sync.service.ts` |

See [Extending the server](development/extending.md) for the conventions each of these follows.
