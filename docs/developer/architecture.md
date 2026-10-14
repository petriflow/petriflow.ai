# Architecture

## Runtime flow

```text
Startup or POST /admin/petriflow/sync
  -> ReleaseSyncService fetches GitHub release metadata
  -> missing petriflow-vX.Y.Z.zip assets are downloaded and validated
  -> StorageService atomically installs each version
  -> CacheService retains version-list/latest metadata

MCP tool or resource read
  -> PetriflowDataService reads the requested version from StorageService
  -> result is adapted to the tool or resource response format

validate-process
  -> reject malformed XML immediately
  -> collect XSD validation issues using the stored schema
  -> run registered semantic rules
```

## Main modules

| Area                                           | Responsibility                                                                               |
|------------------------------------------------|----------------------------------------------------------------------------------------------|
| `src/ts/index.ts`                              | Fastify setup, MCP/static routes, mode selection, and server startup.                       |
| `src/ts/services/release-sync.service.ts`      | GitHub API pagination, SemVer latest selection, ZIP validation, and install orchestration.   |
| `src/ts/services/petriflow-snapshot.service.ts`| Validation and installation of the checked-in snapshot in LOCAL mode.                      |
| `src/ts/services/petriflow-version.service.ts` | Mode-selected version listing, latest resolution, and version availability.                |
| `src/ts/services/petriflow-runtime.service.ts` | Startup initialization for LOCAL snapshots or REMOTE synchronization.                      |
| `src/ts/services/singleton-registry.service.ts` | Process-wide default service instances shared across the main and XMCP adapter bundles.     |
| `src/ts/services/storage.service.ts`           | Per-version filesystem storage and atomic installation.                                      |
| `src/ts/services/cache.service.ts`             | Small persistent metadata cache, not release-file storage.                                   |
| `src/ts/services/petriflow-data.service.ts`    | Shared version resolution and readers for schema, overview, elements, actions, and examples. |
| `src/ts/services/validation.service.ts`        | XML/XSD validation followed by registered semantic rules.                                    |
| `src/ts/services/action-validation.service.ts` | Persistent Groovy subprocess protocol for action/function compilation.                       |
| `src/ts/resources/`                            | xmcp-discovered MCP resources and resource templates.                                        |
| `src/ts/tools/`                                | xmcp-discovered MCP tools.                                                                   |

## Release data contract

In REMOTE mode each published language version is represented by a GitHub release asset named
`petriflow-vX.Y.Z.zip`. Its archive root contains the schema, overview, action definitions, element XSDs, and process
examples. In LOCAL mode the server installs the one checked-in snapshot from `src/petriflow/snapshot/`; it is an explicit
data source, not a REMOTE fallback. Installed version directories are immutable and are only marked available after a
complete validated install.

## Build/runtime details

- `xmcp build` generates `.xmcp/`; never edit generated files by hand.
- `build.mjs` bundles the server as CommonJS with esbuild and copies `src/public`, `src/groovy`, and
  `src/petriflow/snapshot` to `dist`.
- The main server entry and generated XMCP adapter can contain separate module graphs. Module-local `new Service()`
  exports are therefore not process singletons; default services use the `globalThis`/`Symbol.for` registry. Keep
  registry keys stable and namespaced. The registry is per Node.js realm, not across workers or processes.
- Logger consumers use `getLogger()` so `setLogger(app.log)` is visible across those module graphs.
- `libxmljs2` is a native addon and remains external to the bundle.
- `__dirname` in the built server resolves under `dist`; this is also why the current default release storage is
  `dist/storage`.
