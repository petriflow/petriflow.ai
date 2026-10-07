# petriflow.ai documentation

`petriflow.ai` is an HTTP [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for the Petriflow
process language. It is built with [xmcp](https://xmcp.dev/) and Fastify.

Choose a guide:

| Audience              | Start here                                                         |
|-----------------------|--------------------------------------------------------------------|
| MCP client users      | [Getting started](user/getting-started.md)                         |
| Server administrators | [Installation and configuration](admin/installation-and-config.md) |
| Developers            | [Architecture](developer/architecture.md)                          |

The server exposes tools for Petriflow versions, schemas, elements, actions, examples, and validation. The same data is
available through MCP resources and resource templates. Versioned content is synchronized from Petriflow GitHub release
ZIP assets.

## Documentation site

This site is rendered by Docsify 5 from Markdown in this directory. Docsify is loaded from a CDN; this repository does
not install `docsify-cli` or add a documentation build step. Serve the `docs/` directory from any static web host to
publish it. The repository does not configure a hosting provider.
