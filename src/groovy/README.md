# Groovy Action Validation

This directory contains the Groovy side of the `validate_action` MCP tool. It
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
| `tools/generate-delegate.groovy` | Regenerates `lib/ActionDelegate.groovy` from the pinned NAE source, or from a local NAE checkout. |

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
  (returns a synthetic `Object`-returning method). On the delegate, an unknown
  name is still reported, but a known DSL method called with dynamically typed
  arguments (for example `assignTask(findTask { ... })`) is accepted, so
  `def` values from `findTask`/`findCases` do not produce false positives.
- `handleUnresolvedProperty` — allows property access on `Object` and stub types
  (typed as `Object`), but not on the delegate.
- `onMethodSelection` — drops the direct-call target for synthetic methods so
  code generation emits a dynamic dispatch instead of a static call to a
  non-existent method.

The stub domain types (`Field`, `Case`, `Task`, …) carry the commonly-accessed
properties (`value`, `stringId`, `importId`, …) and a `getAt` method so that
`field.value[0]` type-checks.

## Regenerating the stripped delegate

`lib/ActionDelegate.groovy` is generated from the original NAE `ActionDelegate`,
which is **not** part of this project. The generator downloads it from the NAE
repository at the ref pinned in `NAE_REF`:

```bash
# Pinned ref (NAE_REPO / NAE_REF / NAE_PATH in the script)
groovy src/groovy/tools/generate-delegate.groovy

# Another ref, or a different path inside that ref
groovy src/groovy/tools/generate-delegate.groovy --ref master --path src/main/groovy/com/netgrif/application/engine/petrinet/domain/dataset/logic/action/ActionDelegate.groovy

# Local NAE checkout (wins over the download)
groovy src/groovy/tools/generate-delegate.groovy --source /path/to/application-engine/src/main/groovy/com/netgrif/application/engine/petrinet/domain/dataset/logic/action/ActionDelegate.groovy

# Fail instead of writing when the checked-in file is out of date
groovy src/groovy/tools/generate-delegate.groovy --check
```

Other flags: `--out <file>` (defaults to `src/groovy/lib/ActionDelegate.groovy`)
and `--help`. The generated header records the source ref, path, and SHA-256, so
the checked-in artifact can be traced back to an exact NAE revision.

To move to a newer NAE, change `NAE_REF` and `NAE_PATH` together, regenerate, run
`--check`, review the diff, and commit the script constants with the generated
file. `--check` needs network and Groovy, so it is not part of the build; the
generated file stays checked in and the build never downloads NAE.

The generator:

- Extracts every public method signature (name, parameters, return type) from the
  original, replacing bodies with `null`.
- Replaces default parameter values with `null` (so `change(field)` still matches
  `change(Field, Case = null, Optional = null)`).
- Emits stub types for every NAE domain class referenced by the signatures or by
  the delegate's context fields, including generic arguments such as
  `Optional<Task>` and `List<EventOutcome>`. Stubs are empty: the generated class
  is only used for compilation, so no implementation is copied.
- Emits typed result classes for the DSL chains (`change(...).value { ... }`,
  `changeCaseProperty(...).about { ... }`, `make(...).on(...).when { ... }`, …).
- Emits the delegate's context fields (`useCase`, `task`, `params`, …) and
  closure-valued fields (`visible`, `editable`, `transitions`, …).

## Protocol

The daemon speaks newline-delimited JSON over stdio.

Three request shapes are accepted:

**Validate an action (standalone):**

```json
{"source": "Field c_active = null\nchange c_active value { true }"}
```

**Validate an action with injected process functions:**

```json
{"source": "Field h = null\nlog_entry(h, \"hi\")",
 "functions": [{"name": "log_entry", "body": "{ def a, def b -> change a value { b } }"}]}
```

**Validate a standalone function body (a Groovy closure):**

```json
{"function": "{ def u -> u.fullName }"}
```

Response (stdout):

```json
{"ok": true}
```

or

```json
{"ok": false, "issues": [{"rule": "compile", "severity": "error", "line": 2, "column": 1, "message": "..."}]}
```

Line/column numbers are reported relative to the original action/function source
(the wrapper preamble is subtracted).

### Function injection

Process `<function>` bodies are Groovy closures (`{ def a, def b -> ... }`). To
make them resolvable under `@CompileStatic`, the daemon rewrites each closure
header into a method signature (`def <name>(def a, def b) { ... }`) before
compiling. The closure parameter names are preserved; parameter *types* are
`def` (dynamically typed), matching NAE's dynamic dispatch.

## Known limitations

- **Custom delegate methods** — methods added by a customized `ActionDelegate`
  (e.g. `usersWithRole`, `assignTask` from a custom `CustomActionDelegate`) are
  neither base DSL methods nor process `<function>`s, so they are reported as
  undefined. This is inherent to validating without the deployment's full
  classpath.
- **Dynamic property access inside functions** — function bodies with `def`
  parameters access properties dynamically (e.g. `u.fullName`); these are allowed
  (typed `Object`), so typos in those properties are not caught. DSL method-name
  typos are still caught.
- **Field existence** — `validate_action` (standalone) does not check field
  existence; the `action-validation` rule does (it has the process's `<data>` and
  `<transition>` declarations).
- **Closure-shared variables** — reusing a `def` variable inside a closure for
  values of different types (for example `def c = findCase { ... }` followed by
  `c.getFieldValue(...)`) can still produce Groovy's "closure shared variable"
  error. That diagnostic comes from `@CompileStatic`'s variable analysis rather
  than from method resolution, so the extension cannot relax it.

## Requirements

- A JVM (OpenJDK 21) and Groovy (4.0.x) on `PATH`. The `Dockerfile` installs both
  into the runtime image.
