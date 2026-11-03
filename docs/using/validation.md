# Validation

Two validators answer different questions: `validate_process` checks a process document, `validate_action` checks
Groovy action code. Both return the same shape — a boolean and a list of issues.

## Process validation

`validate_process(version, xml)` runs three stages in order and stops at the first that produces errors:

1. **Well-formedness** — the XML parses. Issues carry `rule: "xml"`.
2. **XSD** — the document matches the Petriflow schema for that version, validated with `libxmljs5`. Issues carry
   `rule: "xsd"`.
3. **Semantic rules** — the checks below run against the parsed document. Issues carry the rule name.

```json
{
  "valid": false,
  "issues": [
    {
      "rule": "xsd",
      "severity": "error",
      "message": "Element 'place': This element is not expected.",
      "path": "/process/transition[2]/place",
      "line": 27,
      "column": 9
    }
  ]
}
```

`path`, `line`, and `column` are best-effort locations. Treat them as hints, not a parser contract.

### Semantic rules

| Rule | Checks |
|---|---|
| `valid-version` | The document version is a valid semantic version |
| `unique-ids` | Transition and place ids are unique |
| `valid-identifiers` | Ids are Java-style identifiers and not reserved words |
| `unique-action-ids` | Every action has a unique `id` |
| `arc-direction` | No arc connects two transitions or two places |
| `arc-connectivity` | Every arc references an existing transition and place |
| `place-tokens` | Place tokens are a non-negative integer |
| `action-validation` | Actions and custom functions compile against the DSL, and field/transition references resolve |

`action-validation` is asynchronous: it drives a persistent Groovy subprocess, so it is the slowest stage and the only
one that needs an external runtime. The other rules are pure DOM checks.

### Disabling rules

`PETRIFLOW_DISABLED_RULES=action-validation` skips Groovy compilation, which is the usual choice when the host has no
JVM. Unknown rule names are warned about and ignored. XML parsing and XSD validation are not feature-flagged and always
run.

## Action validation

`validate_action(definition)` compiles a Groovy action or function body against the Petriflow DSL and reports compile
errors with line and column positions. It needs **Java 21** and **Groovy 4.0.33** on `PATH` — both ship in the Docker
image. Outside the image, a missing runtime surfaces as a tool error, not a validation issue.

Use it for the body of a `<function>` or an action `definition`, not for the enclosing XML.

## Reading the results

- `valid: true` with an empty `issues` list means the document passed every enabled stage.
- `valid: true` with warnings is possible: warnings never invalidate a document.
- `valid: false` means at least one error was reported; fix errors before warnings.
- Issues from one rule do not suppress another's, so a single response can mix XSD and semantic findings.

Validation is stateless. The server keeps no per-document state between calls, and repeated calls with the same input
return the same result.
