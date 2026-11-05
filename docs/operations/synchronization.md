# Synchronization

In `REMOTE` mode the server keeps a local mirror of published Petriflow releases. Synchronization is the only part of
the server that talks to GitHub, and it never runs in `LOCAL` mode.

## When it runs

- **At startup**, before the server starts listening. Failures are logged and do not stop the process; already stored
  versions remain available.
- **On demand**, through `POST /admin/petriflow/sync`. This is the retry path after a network failure or after upstream
  publishes a release.

Runs are serialized: concurrent calls share one in-flight synchronization instead of downloading twice.

## The admin endpoint

```bash
curl -X POST http://localhost:3000/admin/petriflow/sync
```

| Status | Body `status` | Meaning |
|---|---|---|
| `200` | `synchronized` | Every discovered version is installed |
| `503` | `partial` | Some versions failed; the rest installed |
| `503` | `failed` | The run itself failed, for example GitHub is unreachable |
| `409` | `disabled` | Server runs in `LOCAL` mode |

A report lists what happened:

```json
{
  "status": "partial",
  "discoveredVersions": 10,
  "downloadedVersions": ["1.0.9"],
  "alreadyInstalledVersions": ["1.0.8"],
  "failedVersions": [
    {"version": "1.0.7", "message": "Release asset petriflow-v1.0.7.zip not found"}
  ]
}
```

Retrying is always safe: installed versions are skipped, so a retry only re-attempts what failed or is new.

## The release archive contract

Synchronization downloads an asset named exactly `petriflow-vX.Y.Z.zip` from the `petriflow/petriflow` release. The
archive root is flat — no top-level directory.

Required files:

| Path | Rule |
|---|---|
| `petriflow.schema.xsd` | Non-empty |
| `overview.md` | Non-empty |
| `actions-definitions.json` | Non-empty, valid JSON object |
| `elements/*.xsd` | At least one |
| `examples/*.xml` | At least one |

Optional file:

| Path | Rule |
|---|---|
| `components-definitions.json` | When present: JSON object keyed by component id |

Each component definition requires non-empty `names` and `fieldTypes` string arrays plus non-empty `description` and
`whenToUse` strings. `params` is optional; each entry needs non-empty `name`, `type`, and `description` strings and a
boolean `required`. `examples` is an optional array of strings, `deprecated` an optional boolean.

A malformed archive fails the whole version install with a message naming the file and field. Because installed versions
are immutable, a bad archive is not repaired by a later run — upstream must publish a corrected release.

## Validation and installation

1. The ZIP is extracted in memory; every entry path is checked for traversal (`..`, absolute paths, drive letters,
   backslashes).
2. The contract above is validated, including JSON shape.
3. Files are written to a temporary directory, then renamed into `storage/<version>/`.
4. `.complete` is written last; only then does the version become readable.

Versions are never partially visible, and an existing complete version is never overwritten.

## Upstream status

`petriflow/petriflow` releases currently publish **no assets**. A `REMOTE` server therefore discovers versions, records
each one in `failedVersions` with `Release asset petriflow-vX.Y.Z.zip not found`, and serves no data for them. That is
why `LOCAL` is the default; switch to `REMOTE` once the archives are published.

## Storage growth

Every installed version stays until an operator removes it. To reclaim space, stop the server and delete a version
directory; the next synchronization will not re-download it unless the release is still listed and the version is
missing from `storage/`. Removing a version that clients still request turns its tools into "not found" errors.
