# Deployment

The server is a single stateless process that reads language data from disk. That makes deployment simple: one
container, one volume, one port.

## Container

```bash
docker run -d --name petriflow-mcp \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v petriflow-storage:/app/storage \
  netgrif/petriflow-mcp:1.1.0
```

| Setting | Value | Note |
|---|---|---|
| Image | `netgrif/petriflow-mcp:<version>` | Pin a version; `latest` moves |
| Port | `3000` | Image binds `0.0.0.0` |
| Volume | `/app/storage` | Installed Petriflow versions |
| Cache | `/app/cache.json` | Version metadata, safe to lose |
| User | `node` (uid from the image) | Volume must be writable by it |

Bind the port to loopback (`127.0.0.1:3000:3000`) and let a proxy handle external access, since the server has no
authentication.

## Health and readiness

`GET /health` returns `{"status":"ok"}` once the server is listening. It checks only that the process is running and
does not confirm that language data is installed or current. A failed `LOCAL` snapshot install prevents startup, but
`REMOTE` synchronization failures are logged and the server still starts with whatever is already in storage.

If a deployment requires language data, add a separate readiness check instead of relying on `/health` — for example
call the `list_versions` tool from an MCP client and assert the expected version, or verify that version's directory in
`storage/` exists.

```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/health"]
  interval: 30s
  timeout: 5s
  retries: 3
```

Docker Compose equivalent:

```yaml
services:
  petriflow-mcp:
    image: netgrif/petriflow-mcp:1.1.0
    ports: ["127.0.0.1:3000:3000"]
    volumes: ["petriflow-storage:/app/storage"]
    environment:
      PETRIFLOW_MODE: LOCAL
      LOG_LEVEL: info
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/health"]
      interval: 30s
volumes:
  petriflow-storage:
```

## Reverse proxy

Forward `/mcp` unchanged and do not buffer responses. The MCP stream uses `GET /mcp` and long-lived responses.

```nginx
location /mcp {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_buffering off;
    proxy_read_timeout 3600s;
}
location /health {
    proxy_pass http://127.0.0.1:3000;
}
```

If the server is reachable beyond localhost, add authentication at the proxy for `/mcp`, `/admin/petriflow/sync`, and
`/applications/package`.

## Resources

- **Memory** — the JVM used for action validation dominates: give the container at least 512 MB, more for large process
  documents.
- **CPU** — validation is CPU-bound; one core per concurrent validation is a reasonable start.
- **Disk** — the bundled snapshot is a few megabytes; `REMOTE` storage grows with each installed version.

## Scaling

Read paths are stateless, so several replicas can serve `/mcp` from the same read-only data. Two cautions:

- Only one replica should run `REMOTE` synchronization, or all of them will download the same archives concurrently.
  Installs are atomic and idempotent, but the work is duplicated.
- A shared volume must support atomic directory renames for `storage/`; if it does not, keep storage per replica.

## Logs

Pino JSON on stdout. Ship them to your log stack; useful fields are `msg`, `level`, and the structured context on
synchronization reports (`downloadedVersions`, `failedVersions`).

## Upgrades

1. Read the release notes for the new tag.
2. Pull the image and restart with the same volume.
3. Check `/health`, then call `list_versions` from a client to confirm the expected language version.

Installed versions are immutable, so an upgrade adds data rather than rewriting it. `LOCAL` deployments always use the
image's snapshot; `storage/` may still hold versions from an earlier `REMOTE` run, which `LOCAL` ignores.
