# Architecture

One Fastify process. xmcp discovers tools and resources from the filesystem and mounts them on an adapter; services
hold the domain logic and are shared through a singleton registry.

## Runtime flow

```text
Startup
  -> LOCAL (default): PetriflowSnapshotService validates and installs the bundled snapshot
  -> REMOTE: ReleaseSyncService fetches GitHub release metadata
       -> releases not installed locally are downloaded when their petriflow-vX.Y.Z.zip asset is available
       -> a missing ZIP asset fails that version's sync
       -> StorageService atomically installs each version
       -> CacheService retains version-list/latest metadata

POST /admin/petriflow/sync (REMOTE only)
  -> ReleaseSyncService retries missing or failed releases

MCP tool or resource call
  -> PetriflowDataService reads the version from StorageService
  -> result is adapted to the tool or resource response
```

## Components

| Path | Responsibility |
|---|---|
| `src/ts/index.ts` | Fastify setup, `/health`, `/mcp`, admin route, startup sequence |
| `src/ts/routes/` | HTTP routes outside the MCP surface |
| `src/ts/tools/` | xmcp-discovered MCP tools, one file each |
| `src/ts/resources/` | xmcp-discovered resources; directory names form the URI |
| `src/ts/services/` | Domain logic: versions, storage, data, validation, sync |
| `src/ts/services/rules/` | Semantic validation rules |
| `src/petriflow/snapshot/` | Checked-in Petriflow release used by `LOCAL` mode |
| `src/groovy/` | Groovy support for action validation |
| `src/public/` | Landing page and assets served at `/` |

### Services

| Service | Role |
|---|---|
| `petriflow-runtime.service` | Chooses snapshot install or synchronization at startup |
| `petriflow-version.service` | Active catalog: `listVersions`, `resolveVersion`, `useLocal`/`useRemote` |
| `petriflow-data.service` | Reads schema, overview, elements, actions, components, examples |
| `storage.service` | Versioned, immutable, atomically installed release files |
| `cache.service` | Small file-backed cache for metadata (not release files) |
| `release-sync.service` | GitHub listing, download, ZIP validation, installation |
| `petriflow-snapshot.service` | Validates and installs the bundled snapshot |
| `validation.service` | XML → XSD → semantic rules pipeline |
| `action-validation.service` | Persistent Groovy subprocess for action compilation |
| `feature-flags.service` | Parses disabled rule/tool lists at startup |
| `logger.service` | Process-shared Pino logger |
| `singleton-registry.service` | Shared instances on `globalThis`, stable across module graphs |

The registry exists because the main bundle and the generated xmcp adapter are separate module graphs; without it, the
adapter would build its own service instances and see an empty version catalog.

## Data model

Three layers, deliberately separate:

1. **Catalog** — which versions exist and which is latest. `LOCAL` has one entry; `REMOTE` mirrors GitHub releases.
2. **Storage** — immutable files per version, installed atomically.
3. **Cache** — metadata such as the version list, rebuildable at any time.

Tools and resources never read files directly; they go through `PetriflowDataService`, which resolves the version
through the catalog first. That keeps "version exists" and "version's files exist" distinct and produces precise errors.

## The MCP surface

- **Tools** are files in `src/ts/tools/*.tool.ts` exporting `schema`, optional `outputSchema`, `metadata`, and a default
  async function. Tools with an output schema return `{structuredContent: ...}`; text tools return a string.
- **Resources** are files under `src/ts/resources/`; parentheses in a directory name set the URI scheme and `[param]`
  segments become template parameters. Structured payloads are JSON text resources.
- Every tool's `metadata` passes through `withToolFeatureFlag`, and every tool name is listed in
  `knownToolNames` so unknown disabled names can be reported.

## Native module and build

`libxmljs5` is a native addon used for XSD validation. It is **not** bundled: esbuild marks it external and the runtime
image keeps `node_modules`. The Docker build compiles it against the same Node ABI and Alpine base as the runtime stage.

`pnpm build` runs `xmcp build` (generating `.xmcp/`), then esbuild (`CJS`, `target: node26`, source maps) to
`dist/server.cjs`, then copies `src/public`, `src/groovy`, and `src/petriflow/snapshot` into `dist/`.

## Logging

A single Pino logger is shared through `logger.service`; Fastify is given a config object and the resulting logger is
registered with `setLogger`, because a separately bundled Pino instance fails Fastify's `instanceof` check. Code calls
`getLogger()` at use time, never a captured binding.
