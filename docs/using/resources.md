# Resources

The same language data the tools return is also exposed as MCP resources, which clients can attach to a conversation
or read directly. URIs use the `petriflow://` scheme and mirror the release layout.

## Endpoints

| URI | MIME type | Content |
|---|---|---|
| `petriflow://versions` | `application/json` | Release list with dates and the `latest` flag |
| `petriflow://versions/{version}/schema` | `application/xml` | Complete XSD schema |
| `petriflow://versions/{version}/overview` | `text/markdown` | Language overview |
| `petriflow://versions/{version}/elements` | `application/json` | Element names and descriptions |
| `petriflow://versions/{version}/elements/{element}` | `application/xml` | One element's XSD |
| `petriflow://versions/{version}/actions` | `application/json` | Action functions |
| `petriflow://versions/{version}/actions/{action}` | `application/json` | One action definition |
| `petriflow://versions/{version}/components` | `application/json` | Field components |
| `petriflow://versions/{version}/components/{component}` | `application/json` | One component definition |
| `petriflow://versions/{version}/examples` | `application/json` | Example processes |
| `petriflow://versions/{version}/examples/{app}/{example}` | `application/xml` | One example process |

Structured payloads are JSON text rather than binary blobs, so a client can render or diff them. XSD and XML resources
are returned as text with the matching MIME type.

## Version placeholders

Every `{version}` placeholder accepts a concrete SemVer or `latest`. Completion suggests the versions from the active
catalog — the synchronized catalog in `REMOTE` mode, the single bundled version in `LOCAL` mode. Completion is local: it
never triggers a GitHub request.

## Resources or tools?

They read the same service and return the same data, so pick by client behaviour:

- **Tools** are chosen by the model and return structured content the client can validate against a schema. Better for
  tool-using agents.
- **Resources** are attached or browsed by the user and returned as text. Better for reading a schema into context,
  comparing two releases, or keeping a reference open while modelling.

Reading a resource for a version whose files are missing fails the same way the equivalent tool does; see
[Troubleshooting](using/troubleshooting.md).
