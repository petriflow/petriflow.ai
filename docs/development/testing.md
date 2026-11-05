# Testing

Tests use [Vitest](https://vitest.dev) in a Node environment. They must run offline. Service tests run without
external processes; the only exception is the opt-in integration test that starts a local server subprocess when
`PETRIFLOW_TEST_SERVER_PATH` is set.

## Running

```bash
pnpm test                                   # whole suite, once
pnpm vitest run test/services/storage.service.test.ts
pnpm typecheck                              # source and tests
```

`pnpm test` is `vitest run` — no watch mode. Build first on a fresh checkout, because `@xmcp/adapter` resolves to the
generated `.xmcp/` directory.

## Layout

| Directory | Covers |
|---|---|
| `test/services/` | Services, rules, validation, synchronization |
| `test/routes/` | HTTP routes, including the admin sync endpoint |
| `test/integration/` | Cross-module behaviour, such as the singleton registry |

Tests never live under `src/`. `tsconfig.test.json` includes both trees, so test code is type-checked with the source.

## Isolation rules

- **No network.** `ReleaseSyncService` accepts an injected `fetcher`; tests pass a fake that returns canned JSON and ZIP
  buffers.
- **No shared filesystem.** Storage and cache tests use `mkdtempSync` directories and remove them in `finally`.
- **No external processes in service tests.** The Groovy daemon is tested with a fake child process; the pure reference
  helpers are tested directly. The singleton integration test starts a local server subprocess only when
  `PETRIFLOW_TEST_SERVER_PATH` points at a built server, and is skipped otherwise.
- **No global state leaks.** Services are constructed per test, or reloaded with `vi.resetModules()` when the singleton
  registry is the subject.

## Common patterns

A storage-backed data service:

```ts
const storage = new StorageService(mkdtempSync(path.join(os.tmpdir(), "petriflow-")));
storage.installVersion("1.2.3", {
  "petriflow.schema.xsd": "<schema />",
  "overview.md": "# Overview",
  "actions-definitions.json": "{}",
  "elements/place.xsd": "<place />",
  "examples/simple.xml": "<process />",
});
```

A fake release archive uses `fflate` directly:

```ts
const archive = zipSync({
  "petriflow.schema.xsd": strToU8("<schema />"),
  "overview.md": strToU8("Overview"),
  "actions-definitions.json": strToU8("{}"),
  "elements/place.xsd": strToU8("<element />"),
  "examples/simple.xml": strToU8("<process />"),
});
```

## What to cover

When you change behaviour, the test should fail without the change:

- **Tools and resources** — the data path they call, including an unknown version.
- **Validation rules** — one case that passes and one that trips the rule, plus the issue's `rule` name.
- **Archive handling** — required files, optional `components-definitions.json`, malformed JSON, path traversal.
- **Startup** — `LOCAL` install failure, `REMOTE` sync failure that still starts, and already-installed versions.

A regression test for a bug is written first and watched failing; a test that passes before the fix proves nothing.

## Conventions

- `describe` for a unit, `test` with a sentence describing behaviour.
- Assert on real values, not on mock interactions, unless the interaction is the contract.
- Prefer building the real service over stubbing it; inject the smallest dependency that needs a fake.
- Keep fixtures minimal — a few files, not a copy of the snapshot.

## CI

The pipeline is `build → typecheck → test`. Build is first because it generates the adapter; a green local
`pnpm typecheck` without a build is not reproducible in CI. See [Releases](operations/releases.md).
