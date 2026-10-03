# Groovy Action Validation

This directory contains the Groovy side of the `validate-action` MCP tool. It
validates a single Petriflow action (a Groovy code snippet) by compiling it —
**compile-only, never executed** — against the Petriflow DSL.

## Overview

Petriflow actions are Groovy code embedded in process XML as
`<action id="..."><![CDATA[ ... ]]></action>`. They use:

- **Field/transition references** — `c_active: f.c_active;` (a labeled statement
  declaring a local variable bound to a field) and `transition: t.transitionId;`.
- **DSL methods** — `change`, `changeCaseProperty`, `make`, `findCases`, etc.,
  which live on the NAE `ActionDelegate` class.
- **Custom functions** — process-specific functions defined in `<function>`
  elements and injected into the delegate at runtime.

Because Groovy runs on the JVM, validation happens in a **persistent Groovy
daemon** spawned by the Node server, avoiding per-call JVM startup cost.

## Files

| File | Role |
|---|---|
| `Validator.groovy` | The daemon. Reads newline-delimited JSON on stdin, compiles each action, writes one JSON result per request to stdout. |
| `lib/ActionDelegate.groovy` | **Generated.** A stripped `ActionDelegate` exposing the full DSL method surface (signatures only) plus stub domain types. No Spring/NAE runtime dependencies. |
| `lib/DynamicTypeCheckingExtension.groovy` | A `TypeCheckingExtension` that relaxes static checking for the dynamic parts of the DSL while keeping DSL method names strict. |
| `tools/generate-delegate.groovy` | Regenerates `lib/ActionDelegate.groovy` from the original NAE source (passed as an argument). |

## How validation works

### 1. Field-reference normalization (Node side)

The Node service (`src/ts/services/action-validation.service.ts`) rewrites
Petriflow field/transition references into typed local declarations before
sending the code to the daemon:

```groovy
c_active: f.c_active;              ->  Field c_active = null
transition: t.transitionId;        ->  Transition transition = null
```

The comma-separated multi-reference form is handled too:

```groovy
condition: f.conditionId,          ->  Field condition = null
text: f.textId,                    ->  Field text = null
transition: t.transitionId;        ->  Transition transition = null
```

This is done with a regex because the format is strict, and because `f`/`t` are
used *only* for Petriflow references (they never appear in the compiled Groovy).

### 2. Static compilation (Groovy side)

The daemon wraps the normalized code in a statically-compiled class that extends
the stripped `ActionDelegate`:

```groovy
@CompileStatic(extensions = [DynamicTypeCheckingExtension])
class ActionScript extends ActionDelegate {
    void run() {
        // normalized action code
    }
}
```

Compiling to `Phases.CLASS_GENERATION` gives two things for free:

- **Syntax errors** are caught by the parser.
- **Undefined DSL methods** (typos like `chage` instead of `change`) are caught
  by static type checking, because the method must resolve against
  `ActionDelegate`.

### 3. Dynamic type-checking extension

The DSL is dynamically typed: `field.value` is `Object` and is indexed
(`value[0]`), iterated (`value.collect { ... }`), and passed around freely.
Plain `@CompileStatic` would reject these as false positives.

`DynamicTypeCheckingExtension` relaxes checking for everything that is **not**
the `ActionDelegate`/`ActionScript` itself:

- `handleMissingMethod` — allows method calls on `Object` and stub domain types
  (returns a synthetic `Object`-returning method), but returns an empty list for
  the delegate so undefined DSL methods are still reported.
- `handleUnresolvedProperty` — allows property access on `Object` and stub types
  (typed as `Object`), but not on the delegate.
- `onMethodSelection` — drops the direct-call target for synthetic methods so
  code generation emits a dynamic dispatch instead of a static call to a
  non-existent method.

The stub domain types (`Field`, `Case`, `Task`, …) carry the commonly-accessed
properties (`value`, `stringId`, `importId`, …) and a `getAt` method so that
`field.value[0]` type-checks.

## Regenerating the stripped delegate

`lib/ActionDelegate.groovy` is generated from the original NAE `ActionDelegate`
source, which is **not** part of this project — it is passed to the generator as
an argument:

```bash
groovy src/groovy/tools/generate-delegate.groovy /path/to/NAE/ActionDelegate.groovy
```

An optional second argument overrides the output path (defaults to
`src/groovy/lib/ActionDelegate.groovy`).

The generator:

- Extracts every public method signature (name, parameters, return type) from the
  original, replacing bodies with `null`.
- Replaces default parameter values with `null` (so `change(field)` still matches
  `change(Field, Case = null, Optional = null)`).
- Emits stub types for every NAE domain class referenced by the signatures, with
  common properties on the frequently-used ones.
- Emits typed result classes for the DSL chains (`change(...).value { ... }`,
  `changeCaseProperty(...).about { ... }`, `make(...).on(...).when { ... }`, …).
- Emits the delegate's context fields (`useCase`, `task`, `params`, …) and
  closure-valued fields (`visible`, `editable`, `transitions`, …).

## Protocol

The daemon speaks newline-delimited JSON over stdio.

Request (stdin):

```json
{"source": "Field c_active = null\nchange c_active value { true }"}
```

Response (stdout):

```json
{"ok": true}
```

or

```json
{"ok": false, "issues": [{"rule": "compile", "severity": "error", "line": 2, "column": 1, "message": "..."}]}
```

Line/column numbers are reported relative to the original action source (the
wrapper preamble is subtracted).

## Known limitations

- **Custom functions** — process-specific `<function>` definitions are not on the
  classpath, so calls to them are reported as undefined methods. Validating them
  requires the whole process context and belongs in `validate-process`.
- **Direct field access** — fields referenced without a field-ref declaration
  (e.g. `change pu_authority ...` where `pu_authority` is not declared via
  `pu_authority: f.pu_authority;`) cannot be resolved without the process's data
  fields.
- **Field existence** — `validate-action` does not check that referenced fields
  exist in the process; that is a `validate-process` concern.

## Requirements

- A JVM (OpenJDK 21) and Groovy (4.0.x) on `PATH`. The `Dockerfile` installs both
  into the runtime image.
