# Configuration

The server is configured entirely through environment variables. There is no config file.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port for `/mcp`, `/health`, and the admin endpoint |
| `HOST` | `127.0.0.1` | Bind address. The Docker image sets `0.0.0.0` |
| `LOG_LEVEL` | `info` | Pino/Fastify log level (`debug`, `info`, `warn`, `error`, `silent`) |
| `PETRIFLOW_MODE` | `LOCAL` | `LOCAL` uses the bundled snapshot; `REMOTE` synchronizes GitHub releases |
| `PETRIFLOW_DISABLED_RULES` | *(empty)* | Comma-separated validation rule names to disable |
| `PETRIFLOW_DISABLED_TOOLS` | *(empty)* | Comma-separated tool names to disable |

Any other value for `PETRIFLOW_MODE` fails startup with `PETRIFLOW_MODE must be LOCAL or REMOTE`. Values are trimmed
and matched case-insensitively.

## Data modes

### LOCAL (default)

Startup validates and installs the single checked-in snapshot from `src/petriflow/snapshot/`, copied to
`dist/petriflow/snapshot/` by the build. The server exposes only that SemVer, `latest` resolves to it, and no GitHub
request is made. `POST /admin/petriflow/sync` returns HTTP 409.

A missing or invalid snapshot stops startup. The bundled snapshot is never replaced by a remote release.

### REMOTE

Startup fetches published releases from `petriflow/petriflow`, caches the version list and the latest stable version,
and downloads missing assets named `petriflow-vX.Y.Z.zip`. If GitHub or an asset is unavailable, startup logs the
failure and continues with whatever is already stored; the admin endpoint can retry.

REMOTE is opt-in today: `petriflow/petriflow` releases do not publish ZIP assets yet, so a REMOTE server lists versions
but cannot install their data. Set `PETRIFLOW_MODE=REMOTE` only when the upstream assets exist.

## Storage and cache

Both live next to the built server (`__dirname`), which is `/app` in the container:

| Path | Contents | Recreatable |
|---|---|---|
| `storage/<version>/` | Installed Petriflow release files, marked complete by a `.complete` file | Yes, but slow |
| `cache.json` | Version list, latest stable version | Yes |

Installed versions are immutable: synchronization never overwrites or deletes a complete version directory. In Docker,
mount a named volume at `/app/storage`; `pnpm build` deletes and recreates `dist`, which removes a local storage
directory.

## Disabling features

Both lists are read once at startup. Empty or unset leaves everything enabled. Unknown names produce a warning and are
ignored, so a typo does not silently change behavior.

```bash
# Skip Groovy action compilation in validate_process
PETRIFLOW_DISABLED_RULES=action-validation

# Expose only discovery and validation tools
PETRIFLOW_DISABLED_TOOLS=get_action,get_component,get_element,get_example,list_actions,list_components,list_elements,list_examples
```

Validation rule names: `valid-version`, `unique-ids`, `valid-identifiers`, `unique-action-ids`, `arc-direction`,
`arc-connectivity`, `place-tokens`, `action-validation`.

Tool names: `list_versions`, `get_overview`, `get_schema`, `list_elements`, `get_element`, `list_actions`,
`get_action`, `list_components`, `get_component`, `list_examples`, `get_example`, `validate_process`, `validate_action`.

Disabling `action-validation` removes the Groovy dependency from `validate_process`; `validate_action` remains a tool but
still needs Java and Groovy to run.

## Authentication

The server does not authenticate `/mcp` or `/admin/petriflow/sync`. Protect both at the ingress or reverse proxy if the
server is reachable beyond localhost. `/health` is unauthenticated by design.

## Next

- [Connect a client](getting-started/connect-a-client.md)
- [Synchronization](operations/synchronization.md) — the admin endpoint and archive contract
