# Operations and release synchronization

## Endpoints

| Method and path              | Purpose                                                                                             |
|------------------------------|-----------------------------------------------------------------------------------------------------|
| `GET /health`                | Basic process health (`{"status":"ok"}`). It does not assert that all release assets are installed. |
| `GET` / `POST /mcp`          | MCP HTTP endpoint.                                                                                  |
| `POST /admin/petriflow/sync` | Refresh release metadata and install missing release assets.                                        |

Protect the administrative sync endpoint outside the application. The endpoint waits for synchronization to finish. It
returns HTTP 200 with `status: "synchronized"` on complete success, HTTP 503 with `status: "partial"` / `"failed"`
and error details for remote failures, or HTTP 409 with `status: "disabled"` in LOCAL mode.

Example successful response:
`{"status":"synchronized","discoveredVersions":12,"downloadedVersions":["1.2.3"],"alreadyInstalledVersions":["1.2.2"],"failedVersions":[]}`.

## Startup behavior

With `PETRIFLOW_MODE=REMOTE` (the default), before accepting requests the server fetches published releases from
`petriflow/petriflow`, updates cached version metadata, and downloads missing version assets. If GitHub or an asset is
unavailable, startup logs the failure and continues with locally stored versions. The sync endpoint can retry failed or
newly published versions.

With `PETRIFLOW_MODE=LOCAL`, startup validates and installs the bundled snapshot from `src/petriflow/snapshot/` (copied
to `dist/petriflow/snapshot/` by the build). It exposes only the snapshot's SemVer, with `latest` resolving to that
version, and makes no GitHub requests. `POST /admin/petriflow/sync` returns HTTP 409 without syncing. A missing or invalid
snapshot stops startup; it is not replaced by a remote sync or an older stored release.

An incomplete ZIP is not made available. The archive root must contain `petriflow.schema.xsd`, `overview.md`,
`actions-definitions.json`, at least one `elements/*.xsd`, and at least one `examples/*.xml`. The action definitions
must be valid JSON. Releases are immutable: successful installs are not overwritten or removed by synchronization.

## Storage and rebuild warning

The default storage path is `__dirname/storage`. In the bundled production server this resolves to `dist/storage`. It
survives a process restart only while that directory is preserved. **`pnpm build` deletes and recreates `dist`, so it
also removes `dist/storage`.** A named Docker volume mounted at `/app/dist/storage` preserves releases across
container/image replacement; outside Docker, back up or preserve the storage directory before rebuilding. Configuring a
separate durable storage path is not implemented yet.

In REMOTE mode the bundled snapshot is not a fallback: if a release is listed but its ZIP is missing or invalid, tools
and resources requiring that version cannot return its content until a successful sync. LOCAL mode intentionally uses
only its one bundled snapshot and rejects other versions even when they exist in persistent storage.

## Troubleshooting synchronization

- **Release asset not found:** verify that the GitHub release includes the exact asset name `petriflow-vX.Y.Z.zip`.
- **Invalid ZIP / missing file:** verify the required archive paths and that `actions-definitions.json` is an
  object-valued JSON document.
- **GitHub API/network error:** stored versions remain available; restore connectivity and retry the endpoint.
- **HTTP 503 from sync:** inspect `failedVersions` in the response and server logs. A retry skips already installed
  versions and retries the failed ones.
