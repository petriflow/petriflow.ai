# Petriflow MCP Server

An [MCP](https://modelcontextprotocol.io) server that gives AI clients the Petriflow language: the XSD schema, elements,
actions, field components, annotated example processes, and two validators. One Node process serves everything over
HTTP, so any MCP-capable client can model, inspect, and check Petriflow processes without reading the source repository.

The server ships with a complete Petriflow release bundled in the image, which means it works offline out of the box.

## At a glance

| | |
|---|---|
| **Transport** | MCP over HTTP at `POST /mcp` (Streamable HTTP), same path for `GET` |
| **Data modes** | `LOCAL` — bundled snapshot (default). `REMOTE` — synchronized GitHub releases |
| **Tools** | 13, for discovery, language data, and validation |
| **Resources** | 11 templates over `petriflow://versions/...` |
| **Validation** | XML well-formedness, XSD, 8 semantic rules, and Groovy action compilation |
| **Runtime** | Node.js 26, `libxmljs5` native module, Java 21 + Groovy 5.0.5 for action validation |

## Quick start

The published image already contains the bundled Petriflow release:

```bash
docker run --rm -p 3000:3000 \
  -v petriflow-storage:/app/storage \
  netgrif/petriflow-mcp:latest
```

The server is ready when `GET /health` returns `{"status":"ok"}`, and MCP clients connect to
`http://localhost:3000/mcp`. Nothing is downloaded at startup in the default mode.

From a checkout instead:

```bash
pnpm install
pnpm build
pnpm start          # node dist/server.cjs
```

## Where to go next

| I want to… | Read |
|---|---|
| Run the server, by Docker, bundle, or source | [Installation](getting-started/installation.md) |
| Understand the environment variables and modes | [Configuration](getting-started/configuration.md) |
| Point Claude, VS Code, or Cursor at the server | [Connect a client](getting-started/connect-a-client.md) |
| Look up a tool's inputs and output | [Tools](using/tools.md) |
| Read Petriflow data as MCP resources | [Resources](using/resources.md) |
| Know what `validate_process` checks | [Validation](using/validation.md) |
| Understand `latest`, catalogs, and immutability | [Versions and modes](using/versions-and-modes.md) |
| Deploy it properly | [Deployment](operations/deployment.md) |
| Work on the code | [Local setup](development/local-setup.md) |

## Related projects

- [Petriflow](https://github.com/petriflow/petriflow) — the language and its releases
- [xmcp](https://xmcp.dev) — the MCP framework the server is built on
- [Model Context Protocol](https://modelcontextprotocol.io) — the protocol specification

## License

Apache License 2.0. See [LICENSE.txt](https://github.com/petriflow/petriflow.ai/blob/main/LICENSE.txt).
