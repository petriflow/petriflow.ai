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

Use `list_versions` to discover published Petriflow versions. Most versioned tools and resources accept a concrete
SemVer version or `latest`, which means the latest stable release.

By default, the server synchronizes release metadata and missing ZIP assets at startup (`PETRIFLOW_MODE=REMOTE`). For an
offline/local run, set `PETRIFLOW_MODE=LOCAL`; the server then exposes only the bundled snapshot version and `latest`,
without contacting GitHub. The LOCAL snapshot is stored in `src/petriflow/snapshot/` and included by the build.

## Typical workflow

1. Call `list_versions` and choose a version (or `latest`).
2. Inspect the language with `get_overview` and `get_schema`.
3. Use `list_elements` / `get_element`, `list_actions` / `get_action`, `list_components` / `get_component`, and `list_examples` / `get_example` as needed.
4. Validate a process with `validate_process`, or compile-check a Groovy action with `validate_action`.

See [Tools and resources](tools-and-resources.md) for inputs and outputs.
