import {expect, test} from "vitest";
import {PackageError, parseProcessXml} from "../../src/ts/services/app-packaging.service";
import {PackageBatchStore} from "../../src/ts/services/package-batch.service";

function processFile(name: string, id: string) {
  return parseProcessXml(name, Buffer.from(`<document><id>${id}</id></document>`));
}

function packageErrorOf(fn: () => unknown): PackageError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(PackageError);
    return error as PackageError;
  }
  throw new Error("Expected a PackageError");
}

function createStore(overrides: {ttlMs?: number; maxProcesses?: number; maxPackageBytes?: number; maxBatches?: number; maxRetainedBytes?: number} = {}) {
  let now = 1_000;
  const store = new PackageBatchStore({
    ttlMs: 1_000,
    maxProcesses: 10,
    maxPackageBytes: 10_000,
    maxBatches: 10,
    createId: () => "batch-1",
    now: () => now,
    ...overrides,
  });
  return {
    store,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
    now: () => now,
  };
}

test("creates a batch with manifest data and no processes", () => {
  const {store} = createStore();
  const batch = store.create({
    metadata: {appId: "app", name: "App", version: "1.0.0"},
    validationEnabled: true,
  });

  expect(batch.id).toBe("batch-1");
  expect(batch.processes).toEqual([]);
  expect(batch.validationEnabled).toBe(true);
  expect(store.get("batch-1")).toBe(batch);
});

test("adds processes and slides the expiry window", () => {
  const {store, advance, now} = createStore();
  store.create({metadata: {appId: "app", name: "App", version: "1"}});

  advance(500);
  const batch = store.addProcesses("batch-1", [processFile("a.xml", "a")]);

  expect(batch.processes.map(process => process.id)).toEqual(["a"]);
  expect(store.expiresAt(batch)).toBe(now() + 1_000);
});

test("rejects duplicate ids and filenames, including within one upload", () => {
  const {store} = createStore();
  store.create({metadata: {appId: "app", name: "App", version: "1"}});

  store.addProcesses("batch-1", [processFile("a.xml", "a")]);
  expect(packageErrorOf(() => store.addProcesses("batch-1", [processFile("b.xml", "a")])).statusCode)
    .toBe(409);
  expect(packageErrorOf(() => store.addProcesses("batch-1", [processFile("a.xml", "b")])).statusCode)
    .toBe(409);
  expect(packageErrorOf(() => store.addProcesses("batch-1", [
    processFile("c.xml", "same"), processFile("d.xml", "same"),
  ])).statusCode).toBe(409);
});

test("enforces the process limit without a partial add", () => {
  const {store} = createStore({maxProcesses: 1});
  store.create({metadata: {appId: "app", name: "App", version: "1"}});

  expect(packageErrorOf(() => store.addProcesses("batch-1", [
    processFile("a.xml", "a"), processFile("b.xml", "b"),
  ])).statusCode).toBe(413);

  expect(store.get("batch-1")?.processes).toEqual([]);
});

test("enforces the byte limit without a partial add", () => {
  const {store} = createStore({maxPackageBytes: 10});
  store.create({metadata: {appId: "app", name: "App", version: "1"}});

  expect(packageErrorOf(() => store.addProcesses("batch-1", [
    processFile("a.xml", "a"),
  ])).statusCode).toBe(413);

  expect(store.get("batch-1")?.processes).toEqual([]);
});

test("expires batches on lookup and during sweeps", () => {
  const {store, advance} = createStore({ttlMs: 100});
  store.create({metadata: {appId: "app", name: "App", version: "1"}});

  advance(101);
  expect(store.get("batch-1")).toBeUndefined();

  store.create({metadata: {appId: "app", name: "App", version: "1"}});
  advance(101);
  expect(store.sweep()).toBe(1);
  expect(store.get("batch-1")).toBeUndefined();
});

test("reports unknown and expired batches on append", () => {
  const {store, advance} = createStore({ttlMs: 100});
  expect(packageErrorOf(() => store.addProcesses("missing", [processFile("a.xml", "a")])).statusCode)
    .toBe(404);

  store.create({metadata: {appId: "app", name: "App", version: "1"}});
  advance(101);
  expect(packageErrorOf(() => store.addProcesses("batch-1", [processFile("a.xml", "a")])).statusCode)
    .toBe(404);
});

test("deletes live batches and reports missing or expired ones", () => {
  const {store, advance} = createStore({ttlMs: 100});
  store.create({metadata: {appId: "app", name: "App", version: "1"}});
  expect(store.delete("batch-1")).toBe(true);
  expect(store.delete("batch-1")).toBe(false);

  store.create({metadata: {appId: "app", name: "App", version: "1"}});
  advance(101);
  expect(store.delete("batch-1")).toBe(false);
});

test("caps the number of open batches", () => {
  const {store} = createStore({maxBatches: 1});
  store.create({metadata: {appId: "app", name: "App", version: "1"}});
  expect(packageErrorOf(() => store.create({metadata: {appId: "app", name: "App", version: "1"}})).statusCode)
    .toBe(503);
});

test("caps retained bytes across batches", () => {
  const {store} = createStore({maxRetainedBytes: 10});
  store.create({metadata: {appId: "app", name: "App", version: "1"}});
  expect(packageErrorOf(() => store.addProcesses("batch-1", [processFile("a.xml", "a")])).statusCode)
    .toBe(503);
  expect(store.get("batch-1")?.processes).toEqual([]);

  expect(packageErrorOf(() => store.create({
    manifest: {xml: "<cases/>", content: Buffer.alloc(11)},
  })).statusCode).toBe(503);
});

test("touch slides the expiry window and ignores missing or expired batches", () => {
  const {store, advance} = createStore({ttlMs: 100});
  store.create({metadata: {appId: "app", name: "App", version: "1"}});

  advance(80);
  expect(store.touch("batch-1")).toBeDefined();
  advance(80);
  expect(store.get("batch-1")).toBeDefined();
  advance(21);
  expect(store.get("batch-1")).toBeUndefined();
  expect(store.touch("batch-1")).toBeUndefined();
});
