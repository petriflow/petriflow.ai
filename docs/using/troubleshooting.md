# Troubleshooting

Start with the logs: the server writes structured Pino lines to stdout, and startup problems name the failing component.
`LOG_LEVEL=debug` adds detail.

## The process exits during startup

Startup fails hard when the configured data source is unusable.

| Log | Cause | Fix |
|---|---|---|
| `Petriflow snapshot directory not found` | `LOCAL` mode, snapshot not copied into the image or build | Rebuild (`pnpm build`) or use the Docker image |
| `Petriflow snapshot manifest.json not found` | Snapshot directory is incomplete | Restore `src/petriflow/snapshot/manifest.json` |
| `Invalid Petriflow snapshot manifest` | `version` is not SemVer, or `releaseDate` is not a date | Fix `manifest.json` |
| `is missing required file …` | Snapshot lacks schema, overview, actions, elements, or examples | Restore the missing files |
| `PETRIFLOW_MODE must be LOCAL or REMOTE` | Typo in the environment variable | Use `LOCAL` or `REMOTE` |

In `REMOTE` mode a failed synchronization is **not** fatal: the server logs a warning and starts with whatever is
already stored.

## A version is listed but its data cannot be read

`list_versions` reflects release metadata, which is independent of downloaded files.

- `REMOTE`: the matching `petriflow-vX.Y.Z.zip` must have been downloaded and installed. Check startup logs or call
  `POST /admin/petriflow/sync`. While `petriflow/petriflow` publishes no assets, versions are listed without data.
- `LOCAL`: only the bundled version is available. Older versions in `storage/` are intentionally rejected.

The error names the missing file, for example `Petriflow file overview.md not found for version 1.0.9`.

## Components are missing for a version

`components-definitions.json` is optional in release archives. `list_components` returns an empty list and
`get_component` reports that components are not available for a version whose archive omits it. The bundled `LOCAL`
snapshot always includes the file; a `REMOTE` version may not.

## `latest` cannot be resolved

- `REMOTE`: the version cache is filled during startup synchronization. If GitHub was unreachable, restore connectivity
  and restart, or call `POST /admin/petriflow/sync`.
- `LOCAL`: `latest` is the snapshot version. If this fails, the snapshot did not install — see the startup table above.

## A snapshot upgrade keeps old files

Installed versions are immutable, so if the snapshot's version is already stored, startup keeps the stored files and
logs `Petriflow snapshot version is already installed; using the stored files`. That is expected: bump the snapshot
version in `manifest.json` when its contents change. A warning without a version bump means the image and the volume
disagree.

## Validation reports errors I do not understand

- `rule: "xml"` — the document is not well-formed; the message includes the parser position.
- `rule: "xsd"` — the document does not match the schema for the requested version. Confirm the version in the document
  matches the `version` argument.
- A named rule — read the rule description in [Validation](using/validation.md) and the `path` field for the location.

If `action-validation` fails with a runtime error instead of issues, Java or Groovy is missing on the host. Set
`PETRIFLOW_DISABLED_RULES=action-validation` to keep `validate_process` usable, or use the Docker image.

## `POST /admin/petriflow/sync` returns an error

| Status | Meaning |
|---|---|
| `409` | Server runs in `LOCAL` mode; synchronization is disabled |
| `503` | Some versions failed (`status: "partial"`) or the run failed (`status: "failed"`) |
| `200` | All discovered versions are installed (`status: "synchronized"`) |

A partial result lists `failedVersions` with a message per release. Retrying is safe: already installed versions are
skipped.

## `libxmljs5` fails to load

The module is a native addon and is deliberately not bundled. It must exist in `node_modules` for the same platform and
Node ABI:

- **Docker** — built and copied in the image; nothing to do.
- **Runtime bundle** — targets Node 26 on Alpine (musl). A glibc host needs a matching build, not this bundle.
- **From source** — `pnpm install` compiles it; install `python3`, `make`, `g++`, and `libxml2-dev` first.

## Clients cannot connect

- Use the exact path `http://host:3000/mcp`.
- In Docker, publish the port (`-p 3000:3000`); the image binds `0.0.0.0` internally.
- Behind a proxy, disable response buffering — MCP streams over `GET /mcp`.
- Browser-based clients need same-origin access or proxy CORS headers; the server sets none.
