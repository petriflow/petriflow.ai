# Tools

Fourteen MCP tools. Every tool that reads language data takes a `version` argument: a concrete SemVer such as `1.0.9`,
or `latest`, which resolves through the active version catalog. See [Versions and modes](using/versions-and-modes.md).

## Discovery

| Tool | Inputs | Returns |
|---|---|---|
| `list_versions` | — | Every known release: `version`, `releaseDate`, `prerelease`, `latest` |
| `get_overview` | `version` | The language overview as Markdown: concepts, modelling guidance |
| `get_schema` | `version` | The complete Petriflow XSD as XML text |

`get_overview` is the intended first call for a model new to Petriflow: it explains the language before any XML is
written. `get_schema` is the authority for element and attribute structure.

## Language data

### Elements

| Tool | Inputs | Returns |
|---|---|---|
| `list_elements` | `version` | `name` and `description` for every Petriflow element |
| `get_element` | `version`, `name` | The element's XSD definition |

Element names are the XSD file names: `data`, `transition`, `place`, `arc`, `role`, `function`, `mapping`, `i18n`,
`transaction`, `caseEvents`, `processEvents`, `document`.

### Actions

| Tool | Inputs | Returns |
|---|---|---|
| `list_actions` | `version` | Action functions with `name`, `signature`, `description` |
| `get_action` | `version`, `name` | The full action definition |

`list_actions` flattens alternatives and DSL chains into callable entries, so one definition can appear several times
with suffixed names (`choose-0`, `chain-then`). `get_action` expects the base top-level definition name (`choose`,
`chain`), not the suffixed entry. Pass the base name to retrieve the full definition and all of its alternatives.

### Field components

| Tool | Inputs | Returns |
|---|---|---|
| `list_components` | `version` | Component ids with `names`, `fieldTypes`, `description`, `whenToUse` |
| `get_component` | `version`, `name` | The full definition, including `params` and `examples` |

A component id such as `button-style` is the key; `names` are the values that go inside `<component><name>`. Components
are only available for versions whose release publishes `components-definitions.json` — the bundled snapshot always
does, older release archives may not. For a version without the file, `list_components` returns an empty list and
`get_component` reports that components are not available for that version.

### Examples

| Tool | Inputs | Returns |
|---|---|---|
| `list_examples` | `version` | Example processes with `name`, `app`, `description` |
| `get_example` | `version`, `app`, `example` | The annotated example process XML |

Examples are grouped by application directory, which is why `get_example` needs both `app` and `example`. They are
complete, working processes and the best starting point for a new model.

## Validation

| Tool | Inputs | Returns |
|---|---|---|
| `validate_process` | `version`, `xml` | `valid` plus a list of `issues` |
| `validate_action` | `definition` | `valid` plus a list of `issues` |

Both return structured content:

```json
{
  "valid": false,
  "issues": [
    {
      "rule": "arc-connectivity",
      "severity": "error",
      "message": "Arc references unknown place 'p9'",
      "path": "/process/arc[3]",
      "line": 42,
      "column": 7
    }
  ]
}
```

`validate_process` runs well-formedness, XSD, and semantic rules — see [Validation](using/validation.md) for the full
pipeline and rule list. `validate_action` compiles Groovy against the Petriflow DSL and needs Java 21 and Groovy on the
host; in the Docker image both are present.

## Application packaging

| Tool | Inputs | Returns |
|---|---|---|
| `generate_app_manifest` | `appId`, `name`, `version`, `processes` (optional `description`, `author`, `title`) | A cloud NAE `manifest.xml` as XML text |

`processes` lists process ids that must match the `<id>` inside the packaged process XMLs. `title` defaults to `name`;
optional fields are omitted when empty. The generated manifest omits the optional NAE `imports`, `dependencies`,
`assets`, and `app_meta` fields. To build the complete application ZIP, use the
[packaging endpoints](operations/application-packaging.md).

## Calling conventions

- Versions are matched against the active catalog; an unknown version fails the call rather than falling back.
- `latest` resolves to the latest **stable** release, so prereleases never become the default.
- Tools are read-only and idempotent; none of them writes to storage or changes server state.
- Output is structured MCP content, so clients can render tables instead of raw text.

## Disabling tools

`PETRIFLOW_DISABLED_TOOLS` removes tools at startup. Useful for exposing a read-only subset to a client, or dropping
`validate_action` where Groovy is unavailable. See [Configuration](getting-started/configuration.md#disabling-features).
