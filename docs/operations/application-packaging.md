# Application packaging

The server can package Petriflow process XMLs and a cloud NAE `manifest.xml` into an application ZIP. The
`generate_app_manifest` MCP tool produces the manifest alone; the HTTP endpoints below build the complete bundle. See
[Tools](using/tools.md) for the tool inputs.

## One-shot package

`POST /applications/package` accepts `multipart/form-data`:

| Part | Required | Meaning |
|---|---|---|
| `appId` | yes | Unique application identifier (`app_id`) |
| `name` | yes | Application display name |
| `version` | yes | Application version, for example `1.1.0` |
| `description` | no | Application description |
| `author` | no | Application author |
| `title` | no | Case title; defaults to `name` |
| `validate` | no | `true` validates every uploaded process before packaging; invalid processes return `422` |
| process XML files | yes | One or more process XMLs; their `<id>` values become the process list |

A file named `manifest.xml` is used verbatim. Otherwise the manifest is generated from the fields and the `<id>` inside
each process XML. Generated manifests omit the optional NAE `imports`, `dependencies`, `assets`, and `app_meta` fields.
The response is `application/zip` with `manifest.xml` at the root and processes under `processes/`.

## Batches

Use a batch for incremental uploads. `validate=true` works on both the one-shot endpoint and batches.

| Endpoint | Purpose |
|---|---|
| `POST /applications/package/batches` | Start a batch with manifest fields or `manifest.xml`, plus optional `validate=true`. Returns `{batchId, processCount, validate, expiresAt}`. |
| `POST /applications/package/batches/{batchId}/processes` | Add one or more process XMLs. With `validate=true`, invalid processes return `422` with issues and are not added. |
| `POST /applications/package/batches/{batchId}/complete` | Return the ZIP and delete the batch. |
| `DELETE /applications/package/batches/{batchId}` | Cancel the batch. |

With `validate=true` on either endpoint, each uploaded process is validated against the active latest Petriflow
version. One-shot validation failures return `422` with `status: "invalid"` and the issue list, without a `batchId`.
Batches are process-local and kept in memory for 30 minutes after the last successful upload. They are lost on restart
and are not shared between replicas, so run packaging against a single instance or dedicate one replica to it.

## Limits and errors

Limits: 5 MiB per file, 100 files per request, 16 KiB per field, 100 processes and 50 MiB (including the manifest) per
application, at most 10 open batches, and 200 MiB retained across batches.

| Status | Meaning |
|---|---|
| `400` | Invalid request |
| `404` | Unknown or expired batch |
| `409` | Duplicate process id or file name |
| `413` | A size or count limit was exceeded |
| `422` | Validation failed (`validate=true`) |
| `503` | Validation or batch capacity is unavailable |

The endpoints are not authenticated. Protect them at the ingress or reverse proxy, as you do for `/mcp` and
`POST /admin/petriflow/sync`.
