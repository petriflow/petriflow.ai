# Getting started

## Connect an MCP client

Configure your MCP-compatible client to connect over HTTP to:

```text
https://<server-host>/mcp
```

For a local server, the default URL is `http://localhost:3000/mcp`. The listening port can be changed with the server's
`PORT` environment variable. Client configuration screens differ; use the client's HTTP/remote MCP connection option and
provide the server URL.

The health endpoint is `GET /health` and returns `{"status":"ok"}` when the Fastify server is running. It does not
guarantee that every Petriflow release asset is available.

## Choose a language version

Use `list-versions` to discover published Petriflow versions. Most versioned tools and resources accept a concrete
SemVer version or `latest`, which means the latest stable release.

The server synchronizes release metadata and missing ZIP assets at startup. If an asset is missing or synchronization
fails, version metadata can still be listed, but tools that need files for that version will report that the release
data is unavailable. There is no local fallback copy.

## Typical workflow

1. Call `list-versions` and choose a version (or `latest`).
2. Inspect the language with `get-overview` and `get-schema`.
3. Use `list-elements` / `get-element`, `list-actions` / `get-action`, and `list-examples` / `get-example` as needed.
4. Validate a process with `validate-process`, or compile-check a Groovy action with `validate-action`.

See [Tools and resources](tools-and-resources.md) for inputs and outputs.
