# LOCAL Petriflow snapshot design

## Goal

Allow the MCP server to run with Petriflow materials and no GitHub access when
configured in `LOCAL` mode. Preserve the existing release synchronization
behavior for `REMOTE` deployments.

## Configuration and mode behavior

- Add `PETRIFLOW_MODE`, accepting `LOCAL` or `REMOTE`.
- Default to `REMOTE` to preserve existing deployments and startup behavior.
- Reject unsupported values before the server starts listening.
- In `REMOTE`, keep startup synchronization and the administrative sync endpoint
  as they work today. A failed startup sync continues to log a warning and serve
  already-installed releases; it does not silently load the bundled snapshot.
- In `LOCAL`, do not call GitHub during startup. The
  `POST /admin/petriflow/sync` endpoint returns HTTP 409 without starting a sync.

## Snapshot source and update contract

Track the latest stable Petriflow release snapshot in
`src/petriflow/snapshot/`. Its layout mirrors the root of the release ZIP:

```text
src/petriflow/snapshot/
  manifest.json
  petriflow.schema.xsd
  overview.md
  actions-definitions.json
  elements/*.xsd
  examples/*.xml
```

`manifest.json` records the concrete SemVer release and its release date. The
snapshot files are checked into the repository; neither the build nor the
runtime downloads them. `build.mjs` copies this directory to
`dist/petriflow/snapshot/` after recreating `dist`.

To update the snapshot, replace the release files from the latest stable
`petriflow-vX.Y.Z.zip`, update the manifest version/date, and verify the snapshot
with the project tests and build. Document this procedure with the environment
configuration. Automated snapshot refresh is out of scope.

## Runtime data flow

Use one mode-selected version catalog as the source of `latest`, version lists,
and completion values. In `REMOTE`, this is the existing release synchronization
service. In `LOCAL`, initialize a catalog containing only the SemVer and release
date from the snapshot manifest.

At LOCAL startup, validate the manifest and required release files (including
valid action-definition JSON and non-empty element/example files), then install
the snapshot atomically into the existing `StorageService`. The local catalog
exposes exactly this version, marks it as latest, and resolves `latest` to it.
Explicit requests for any other version are rejected in LOCAL even if older
releases are present in persistent storage. Existing Petriflow data consumers
(tools, resources, completions, and validation) use the selected catalog and
shared data service rather than reaching directly into the remote sync service.

REMOTE behavior remains unchanged: fetch release metadata/assets, preserve
installed releases, and expose the synchronized catalog. The bundled snapshot
is not a REMOTE fallback.

## Failure handling

- Invalid mode: fail startup with a clear configuration error.
- Missing or malformed LOCAL manifest, missing required snapshot files, or an
  invalid snapshot: fail before listening; do not fall back to GitHub or serve a
  partial snapshot.
- Existing completed SemVer installs remain immutable, consistent with current
  storage behavior.
- LOCAL administrative sync: return HTTP 409 and make no network request.
- REMOTE sync failures retain current behavior and logs.

## Verification

- Unit-test mode parsing, including the REMOTE default and invalid values.
- Test LOCAL snapshot validation/installation, latest resolution, one-version
  listing/completions, and rejection of other versions even when storage has
  them installed.
- Test that LOCAL startup and the admin endpoint do not call the network; test
  that REMOTE still invokes the existing sync flow.
- Test snapshot copying in the build pipeline or verify the built artifact
  contains the snapshot.
- Run `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## Out of scope

- Automatically updating or downloading the checked-in snapshot.
- Falling back to bundled materials in REMOTE mode.
- Changing the existing remote synchronization API or release immutability.
