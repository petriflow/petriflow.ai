# Connect a client

The server speaks MCP over HTTP on a single endpoint:

```
http://localhost:3000/mcp
```

`POST` carries client requests and `GET` opens the server-to-client stream. No separate port, no stdio process, no
authentication.

## Before you connect

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

If that fails, fix the server first — see [Installation](getting-started/installation.md). If it succeeds but a client
cannot connect, the client is usually pointed at the wrong path (it must end in `/mcp`, not `/`).

## Client configuration

Client configuration formats differ; these are the current shapes for the common ones.

### VS Code

`.vscode/mcp.json` in a workspace, or the user-level equivalent:

```json
{
  "servers": {
    "petriflow": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "petriflow": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Clients with stdio only

Claude Desktop and other stdio-only clients reach a remote HTTP server through the `mcp-remote` bridge:

```json
{
  "mcpServers": {
    "petriflow": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/mcp"]
    }
  }
}
```

Some clients name the transport `streamable-http` instead of `http`. Both describe the same endpoint; use whichever the
client's documentation lists.

## What the client sees

After connecting, the client lists 14 tools and 11 resource templates. A sensible first conversation:

1. `list_versions` — confirm which Petriflow release is active.
2. `get_overview` — load the language concepts before modelling.
3. `get_schema` — the full XSD when precise element structure matters.
4. `validate_process` — check a process you just wrote.

The server sends tool descriptions and resource titles to the client; the model can pick tools without extra prompting.
Full details are in [Tools](using/tools.md) and [Resources](using/resources.md).

## Remote and containerised servers

Replace `localhost:3000` with the reachable host and port. In Docker the image binds `0.0.0.0:3000`, so
`-p 3000:3000` is enough for local use; behind a proxy, forward `/mcp` unchanged and keep streaming responses
unbuffered. The server sets no CORS headers, so browser-based clients must be served from the same origin or through a
proxy that adds them.

## Security note

There is no authentication. Anyone who can reach `/mcp` can read the bundled language data and call the validators, and
anyone who can reach `/admin/petriflow/sync` can trigger a synchronization in `REMOTE` mode. Keep the server on
loopback or behind an authenticated proxy.
