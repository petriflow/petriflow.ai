# Extending the server

## Add or change a tool

Tools are auto-discovered from `src/ts/tools/*.tool.ts`. A tool exports a Zod `schema`, `metadata`, an optional
`outputSchema`, and a default handler. Tools with an `outputSchema` return `{ structuredContent: { ... } }`; tools
without one return plain text.

Keep data access in shared services. Existing Petriflow tools delegate versioned reads to `PetriflowDataService` rather
than reading storage or contacting GitHub themselves.

## Add or change a resource

Resources are discovered from `src/ts/resources/` using filesystem routes:

- Parentheses create the URI scheme: `(petriflow)` becomes `petriflow://`.
- Static path segments become URI segments.
- Bracketed names such as `[version]` become template parameters.
- A dynamic resource must export a default handler as well as its schema and metadata.
- Every resource containing a `{version}` parameter exports `complete` from `version-completions.service.ts`. Completion
  reads cached release metadata and must not make a network request.

Keep a resource's returned data aligned with the corresponding tool by calling the same data-service method. Structured
tool content is represented as JSON text in a resource; schemas, Markdown, and process XML are returned as text with a
suitable MIME type.

## Add a semantic validation rule

Create `src/ts/services/rules/<name>.rule.ts` and export a `ValidationRule` with `name`, `description`, and
`validate(doc, ctx)`. `validate` may be synchronous or asynchronous. Register it in the `rules` array in
`src/ts/services/rules/index.ts`.

Use helpers from `rules/helpers.ts` for local-name XPath lookups and identifier/integer parsing. Add tests under
`test/services/rules/` for valid, invalid, and boundary inputs.

## Change release data

The Petriflow repository is the source of truth. Add versioned content to the release asset using the exact root paths
documented in [Operations and release synchronization](../admin/operations-and-sync.md); do not duplicate release data
in this repository.
