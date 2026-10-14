# Tools and resources

Tools and resources share the same versioned Petriflow data services. Tools with an output schema return structured
content; raw schema, overview, element, and example tools return text.

## Tools

| Tool               | Inputs               | Result                                                                 |
|--------------------|----------------------|------------------------------------------------------------------------|
| `list-versions`    | None                 | Published versions with release date, prerelease, and latest flags.    |
| `get-schema`       | `version`            | Complete XSD as text.                                                  |
| `get-overview`     | `version`            | Version overview as Markdown text.                                     |
| `list-elements`    | `version`            | Element names and descriptions.                                        |
| `get-element`      | `version`, `name`    | Element XSD as text.                                                   |
| `list-actions`     | `version`            | Action names, signatures, and descriptions.                            |
| `get-action`       | `version`, `name`    | Full action definition.                                                |
| `list-examples`    | `version`            | Example names and descriptions taken from their XML titles.            |
| `get-example`      | `version`, `example` | Example process XML as text.                                           |
| `validate-process` | `version`, `xml`     | `{ valid, issues }` after XML, XSD, and semantic checks.               |
| `validate-action`  | `definition`         | `{ valid, issues }` from Groovy compilation against the Petriflow DSL. |

For all versioned tools, `latest` resolves to the latest stable version. `validate-action` accepts an action body, not a
full process XML document; it compiles the code but never executes it.

## Resources

Resources expose the same data for clients that read MCP resources instead of calling tools. List and definition
resources are JSON text; XSD and XML resources are returned as text with an appropriate MIME type.

| Resource URI                                        | Content                 |
|-----------------------------------------------------|-------------------------|
| `petriflow://versions`                              | Version list.           |
| `petriflow://versions/{version}/schema`             | Complete XSD.           |
| `petriflow://versions/{version}/overview`           | Overview Markdown.      |
| `petriflow://versions/{version}/elements`           | Element list.           |
| `petriflow://versions/{version}/elements/{name}`    | Element XSD.            |
| `petriflow://versions/{version}/actions`            | Action list.            |
| `petriflow://versions/{version}/actions/{name}`     | Action definition JSON. |
| `petriflow://versions/{version}/examples`           | Example list.           |
| `petriflow://versions/{version}/examples/{example}` | Example process XML.    |

The dynamic `{version}` parameter offers completion suggestions from the active version catalog, including `latest`.
REMOTE uses synchronized release metadata; LOCAL suggests only the bundled snapshot version. Completion suggests values; it
does not download data or replace validation when reading a resource.

## Validation results

`validate-process` returns a `valid` boolean and an `issues` array. Each issue includes a rule identifier, severity
(`error` or `warning`), and message; source location or an element path may also be present. Warnings do not make the
result invalid.

`validate-action` returns compilation issues with optional line and column numbers.
See [server requirements](../admin/installation-and-config.md) for its JVM/Groovy requirements.
