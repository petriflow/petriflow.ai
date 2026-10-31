# petriflow.ai

An [MCP](https://modelcontextprotocol.io) server for [Petriflow](https://github.com/netgrif/petriflow), built
with [xmcp](https://xmcp.dev) + Fastify. It exposes Petriflow tools to MCP-compatible AI clients over HTTP.

See the [project documentation](docs/README.md) for user, server administration, and developer guides.

## Getting Started

Requires Node.js >= 22.12.0 and pnpm.

```bash
pnpm install
pnpm dev        # build then run
```

This starts the MCP server on `http://localhost:3000` (the `/mcp` endpoint). Override the port with `PORT` or the bind
address with `HOST`; the default host is loopback (`127.0.0.1`). Set `PETRIFLOW_MODE=LOCAL` to use the bundled Petriflow
snapshot without GitHub, or leave it unset (`REMOTE`) to synchronize releases. The Docker image sets `HOST=0.0.0.0` for
container port publishing.

## Commands

- `pnpm dev` — build then run the server
- `pnpm build` — `xmcp build && node build.mjs` (regenerates `.xmcp/`, bundles to `dist/server.cjs`, copies
  `src/public` → `dist/public`, `src/groovy` → `dist/groovy`, and `src/petriflow/snapshot` → `dist/petriflow/snapshot`)
- `pnpm typecheck` — type-check source and test files
- `pnpm test` — run Vitest once (no watch mode)
- `pnpm start` — run the already-built server

## Project Structure

- `src/ts/index.ts` — Fastify entrypoint (registers `@xmcp/adapter`, static files, validation rules)
- `src/ts/tools/` — MCP tool definitions, auto-discovered from `*.tool.ts`
- `src/ts/services/` — shared services for cache, storage, release synchronization, Petriflow data, and validation
- `src/ts/services/rules/` — semantic validation rules
- `src/ts/resources/` — MCP resources and resource templates
- `test/` — Vitest service and route tests
- `src/groovy/` — Groovy action-validation daemon (see `src/groovy/README.md`)
- `src/public/assets/` — logo/favicon

### Tools

Each `src/ts/tools/*.tool.ts` exports a `schema` (zod inputs), optional `outputSchema`, `metadata`, and a `default`
function.

Current tools:

| Tool               | Purpose                                                                             |
|--------------------|-------------------------------------------------------------------------------------|
| `list-versions`    | List available Petriflow versions (flags the latest)                                |
| `get-schema`       | Get the full XSD schema for a version                                               |
| `get-overview`     | Show the Petriflow language overview                                                |
| `list-actions`     | List available action functions                                                     |
| `get-action`       | Get the definition of one action                                                    |
| `list-components`  | List field components (`<component><name>`) with when to use each                   |
| `get-component`    | Get the definition and configuration properties of one component                    |
| `list-elements`    | List Petriflow elements                                                             |
| `get-element`      | Get the XSD schema of one element                                                   |
| `list-examples`    | List example processes                                                              |
| `get-example`      | Get the content of one example process                                              |
| `validate-process` | Validate a process XML against its schema and semantic rules                        |
| `validate-action`  | Validate a Petriflow action (Groovy code) by compiling it against the Petriflow DSL |

Tools with an `outputSchema` return `{ structuredContent: { ... } }`; the rest return plain text.

### Resources and release synchronization

Resources mirror the version, schema, overview, element, action, and example data exposed by the tools. Versioned
resource templates use URIs such as `petriflow://versions/{version}/schema` and complete versions from the active
catalog, including `latest`.

In `REMOTE` mode (the default), startup checks releases from `petriflow/petriflow` and installs missing assets named
`petriflow-vX.Y.Z.zip`. In `LOCAL` mode, the server installs the single checked-in snapshot from
`src/petriflow/snapshot/` and makes no GitHub requests. The snapshot includes `manifest.json` and the same schema,
overview, actions, elements, and examples files as a release archive. `POST /admin/petriflow/sync` remains available in
REMOTE mode and returns HTTP 409 in LOCAL mode. Installed releases are immutable and are not deleted or overwritten.

## Validation

`validate-process` runs a pipeline in `src/ts/services/validation.service.ts`:

1. XML well-formedness
2. XSD schema validation (via the native `libxmljs5` module)
3. registered semantic rules

Semantic rules live in `src/ts/services/rules/*.rule.ts` and are registered in `src/ts/services/rules/index.ts`. Each
rule exports `{ name, description, validate(doc, ctx) }` and returns `ValidationIssue[]` (or a `Promise` of one) —
`rule`, `severity`, `message`, optional `path`/`line`/`column`.

The `action-validation` rule compiles every `<action>` and every `<function>` in the process against the Petriflow DSL
(via the Groovy daemon), checks that `f.*`/`t.*` references resolve to declared fields/transitions, and warns about
unused functions.

`validate-action` compiles a single action's Groovy code against the Petriflow DSL in a persistent Groovy daemon. See
`src/groovy/README.md` for details.

> `libxmljs5` is a native addon and must be compiled on install and present at runtime (see `Dockerfile`). The
> `action-validation` rule additionally requires a JVM + Groovy at runtime.

### Configuring validation rules and tools

All semantic validation rules and MCP tools are enabled by default. Disable selected features at server startup with
comma-separated names:

```bash
PETRIFLOW_DISABLED_RULES=action-validation
PETRIFLOW_DISABLED_TOOLS=get_overview,validate_action
```

Rule names match their rule `name`; tool names match XMCP `metadata.name`. Empty or unset variables enable everything.
Unknown names produce startup warnings and are ignored. Restart the server after changing either variable. XML
well-formedness and XSD validation remain enabled regardless of the semantic-rule flags.

## Building for Production

```bash
pnpm build
```

## GitHub Actions releases

Pull requests and pushes to `main` run typechecking, tests, and a production build. To publish a release, make sure
`package.json` contains the intended version and push the matching `vX.Y.Z` tag (for example, `v1.0.0`). The release
workflow rejects tags that do not match the package version, smoke-tests the Docker image, publishes it to Docker Hub,
and creates a GitHub Release with generated notes and a runtime bundle. Stable versions also update the Docker `latest`
tag; prereleases do not.

Configure these repository settings before the first release:

- Repository variable `DOCKERHUB_IMAGE`, set to `netgrif/petriflow-mcp` (or the desired Docker Hub image path).
- Repository secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` with credentials that can publish to that image.
- A branch protection rule requiring `CI / Typecheck, test, and build` on `main`.
- A tag ruleset for `v*` that limits release-tag creation to trusted maintainers.

The attached `.tar.gz` includes `dist/` and production `node_modules`. It targets Node.js 26 on Alpine Linux (musl) and
requires `libxml2`; action validation additionally requires Java 21 and Groovy 4.0.33. The Docker image is the
recommended deployment artifact because it includes the runtime environment.

## Running the Server

```bash
pnpm start            # node dist/server.cjs
```

## Learn More

- [Petriflow](https://github.com/netgrif/petriflow)
- [xmcp Documentation](https://xmcp.dev/docs)
- [Model Context Protocol](https://modelcontextprotocol.io)

## License

Licensed under the [Apache License 2.0](./LICENSE.txt).
