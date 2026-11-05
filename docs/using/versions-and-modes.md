# Versions and modes

Petriflow changes between releases: elements gain attributes, actions gain signatures. The server therefore serves
**versioned** data, and every versioned tool and resource takes a `version` argument.

## The version catalog

The catalog is whatever the active mode provides:

| Mode | Catalog |
|---|---|
| `LOCAL` (default) | Exactly one version — the bundled snapshot |
| `REMOTE` | Every published `petriflow/petriflow` release, plus `latest` |

`list_versions` returns the catalog:

```json
{
  "versions": [
    {
      "version": "1.0.9",
      "releaseDate": "2026-07-30",
      "prerelease": false,
      "latest": true
    }
  ]
}
```

## Resolving `latest`

`latest` means the latest **stable** release. Prereleases and drafts are excluded from that calculation, so a
`2.0.0-rc.1` release never silently becomes the default. Resolution happens against the catalog; there is no need to
call `list_versions` first.

In `LOCAL` mode `latest` is the snapshot version. In `REMOTE` mode it is computed from GitHub release metadata and
cached.

## Unknown versions

A version that is not in the catalog fails the call. The server does not fall back to a nearby version or to the bundled
snapshot — silently answering for the wrong language version would be worse than an error.

In `LOCAL` mode this includes versions that exist in `storage/` from an earlier `REMOTE` run: only the snapshot version
is exposed, and others are rejected even though their files are on disk.

## How data is stored

Each version is a directory under `storage/`:

```text
storage/
  1.0.9/
    .complete                 # written last, marks the install as usable
    petriflow.schema.xsd
    overview.md
    actions-definitions.json
    components-definitions.json   # optional
    elements/*.xsd
    examples/<app>/...
```

Installs are atomic: files are written to a temporary directory and renamed into place, and `.complete` is written only
after every file exists. A version therefore never appears half-installed.

Installed versions are **immutable**. Synchronization does not overwrite or delete them; a version that needs to change
gets a new SemVer.

## Choosing a mode

Use `LOCAL` unless you specifically need older releases:

- **LOCAL** — reproducible, offline, one language version, no GitHub dependency. Correct default for a pinned
  deployment.
- **REMOTE** — exposes every published release and keeps adding new ones. Requires upstream release assets; until
  `petriflow/petriflow` publishes `petriflow-vX.Y.Z.zip`, a REMOTE server lists versions but cannot install their data.

You can run both in different deployments against the same image; the mode is per process.

## Pinning a version

Pin the server image and the language version together. `netgrif/petriflow-mcp:1.0.0` carries one specific snapshot, so
tool behaviour does not change under a running deployment. Upgrade deliberately: pull a new image tag, read its
[release notes](operations/releases.md), and restart.
