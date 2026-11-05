# Extending the server

Three extension points: tools, resources, and validation rules. Tools and resources are discovered from the
filesystem, so adding a file is enough — apart from the feature-flag name list for tools. Validation rules are not
auto-discovered: add each new rule to the `rules` array in `src/ts/services/rules/index.ts` so it is registered at
startup.

## Add a tool

Create `src/ts/tools/my_tool.tool.ts`:

```ts
import {z} from "zod";
import {InferSchema} from "xmcp";
import petriflowDataService from "../services/petriflow-data.service";
import {withToolFeatureFlag} from "../services/feature-flags.service";

export const schema = {
  version: z.string().describe("Version of the schema"),
};

export const outputSchema = {
  elements: z.array(z.object({
    name: z.string().describe("Name of the element"),
    description: z.string().describe("Description of the element"),
  })).describe("List of elements"),
};

export const metadata = withToolFeatureFlag({
  name: "my_tool",
  description: "What the tool does, in one sentence",
  annotation: {
    title: "Short human-readable title",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
});

export default async function myTool({version}: InferSchema<typeof schema>) {
  return {structuredContent: {elements: petriflowDataService.listElements(version)}};
}
```

Rules:

- **Return convention.** With an `outputSchema`, return `{structuredContent: {...}}`. Without one, return a string.
- **Metadata.** Always wrap with `withToolFeatureFlag`, so the tool can be disabled by name.
- **Feature flags.** Add the name to `knownToolNames` in `src/ts/services/feature-flags.service.ts`; otherwise
  disabling it is reported as an unknown name.
- **Data access.** Go through `PetriflowDataService` rather than reading files; it resolves versions and produces the
  right errors.
- **Validation.** Add a test under `test/services/` or `test/routes/` that exercises the real code.

Tool names are snake_case and become the MCP tool identifiers, so treat them as public API: renaming one is a breaking
change.

## Add a resource

Resources live under `src/ts/resources/`. The directory path becomes the URI:

- `(petriflow)/versions/` → scheme `petriflow://versions/...` (parentheses are not part of the URI)
- `[version]/` → `{version}` template parameter

A resource file exports `schema`, `metadata` (`name`, `title`, `description`, `mimeType`), and a default handler that
returns a string. Any resource with a `{version}` parameter must also export `complete`, using the shared
`versionCompletions` service so suggestions stay local:

```ts
export const complete = versionCompletions;
```

Structured payloads are returned as JSON text, matching the equivalent tool.

## Add a validation rule

Create `src/ts/services/rules/my-check.rule.ts`:

```ts
import type {ValidationRule, ValidationIssue} from "../validation.service";
import {findRootChildren} from "./helpers";

export const myCheckRule: ValidationRule = {
  name: "my-check",
  description: "One sentence describing what this rejects.",

  validate(doc) {
    const issues: ValidationIssue[] = [];

    for (const transition of findRootChildren(doc, "transition")) {
      if (!transition.attr("id")) {
        issues.push({
          rule: this.name,
          severity: "error",
          message: "Transition is missing an id.",
        });
      }
    }

    return issues;
  },
};
```

Register the named export in the `rules` array in `src/ts/services/rules/index.ts`. Rules receive a `libxmljs5` document
and may return a promise; the service awaits every rule.

- Use the shared helpers in `rules/helpers.ts` (`childText`, `findRootChildren`, `isJavaIdentifier`,
  `JAVA_RESERVED_WORDS`, `GROOVY_RESERVED_WORDS`, `parseInteger`) instead of re-implementing DOM walks.
- The rule name is the identifier clients see in `issues[].rule`, so keep it stable and add it to the documentation in
  [Validation](using/validation.md).
- Rules are enabled by default and can be disabled with `PETRIFLOW_DISABLED_RULES`.

## Updating documentation

A new tool, resource, or rule is user-visible. Update the matching page under `docs/` in the same change — `using/tools.md`,
`using/resources.md`, or `using/validation.md` — plus the environment-variable lists if the surface changed.

## Conventions

- One exported default per file, named after the file.
- Descriptions are user-facing text: say what the thing does, not how it is implemented.
- Never log with `console`; use `getLogger()`.
- Keep services free of Fastify types so they stay testable without a server.
