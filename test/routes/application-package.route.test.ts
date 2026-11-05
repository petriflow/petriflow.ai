import Fastify, {type FastifyInstance} from "fastify";
import {expect, test} from "vitest";
import {strFromU8, unzipSync} from "fflate";
import {registerApplicationPackageRoutes} from "../../src/ts/routes/application-package.route";
import {PackageBatchStore} from "../../src/ts/services/package-batch.service";
import type {ValidationResult} from "../../src/ts/services/validation.service";
import {multipartBody, type MultipartField, type MultipartPart} from "./multipart.helper";

type Validator = (xml: string) => Promise<ValidationResult>;

interface TestAppOptions {
  now?: () => number;
  ttlMs?: number;
  maxProcesses?: number;
  maxPackageBytes?: number;
  maxFileBytes?: number;
  maxFieldBytes?: number;
  maxBatches?: number;
  validateProcess?: Validator;
}

async function createApp(options: TestAppOptions = {}) {
  const app = Fastify({logger: false});
  let sequence = 0;
  const store = new PackageBatchStore({
    now: options.now,
    ttlMs: options.ttlMs,
    maxProcesses: options.maxProcesses,
    maxPackageBytes: options.maxPackageBytes,
    maxBatches: options.maxBatches,
    createId: () => `batch-${++sequence}`,
  });
  registerApplicationPackageRoutes(app, store, {
    sweepIntervalMs: 0,
    maxFileBytes: options.maxFileBytes,
    maxFieldBytes: options.maxFieldBytes,
    maxProcesses: options.maxProcesses,
    maxPackageBytes: options.maxPackageBytes,
    maxBatches: options.maxBatches,
    validateProcess: options.validateProcess,
  });
  await app.ready();
  return {app, store};
}

async function createAppWithRouteOptionsOnly(options: TestAppOptions = {}) {
  const app = Fastify({logger: false});
  registerApplicationPackageRoutes(app, undefined, {
    sweepIntervalMs: 0,
    maxFileBytes: options.maxFileBytes,
    maxFieldBytes: options.maxFieldBytes,
    maxProcesses: options.maxProcesses,
    maxPackageBytes: options.maxPackageBytes,
    maxBatches: options.maxBatches,
    validateProcess: options.validateProcess,
  });
  await app.ready();
  return {app};
}

async function postMultipart(app: FastifyInstance, url: string, parts: MultipartPart[]) {
  const body = multipartBody(parts);
  return app.inject({
    method: "POST",
    url,
    payload: body.payload,
    headers: {"content-type": body.contentType},
  });
}

function metadataParts(overrides: Partial<Record<"appId" | "name" | "version", string>> = {}): MultipartField[] {
  const values = {appId: "app", name: "App", version: "1.0.0", ...overrides};
  return Object.entries(values).map(([name, value]) => ({name, value}));
}

function processPart(id: string, filename = `${id}.xml`): MultipartPart {
  return {name: "files", filename, content: `<document><id>${id}</id></document>`};
}

function invalidValidator(issues = [{rule: "xsd", severity: "error" as const, message: "bad"}]): Validator {
  return async () => ({valid: false, issues});
}

test("packages metadata and process XMLs in one request", async () => {
  const {app} = await createApp();

  const response = await postMultipart(app, "/applications/package", [
    ...metadataParts(),
    processPart("alpha"),
    processPart("beta"),
  ]);

  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toContain("application/zip");
  expect(response.headers["content-disposition"]).toBe('attachment; filename="app.zip"');

  const entries = unzipSync(response.rawPayload);
  expect(Object.keys(entries).sort()).toEqual(["manifest.xml", "processes/alpha.xml", "processes/beta.xml"]);
  const manifest = strFromU8(entries["manifest.xml"]);
  expect(manifest).toContain("<value>alpha</value>");
  expect(manifest).toContain("<value>beta</value>");

  await app.close();
});

test("uses an uploaded manifest verbatim and ignores metadata", async () => {
  const {app} = await createApp();
  const manifest = "<cases><case><title>Provided</title></case></cases>\n";

  const response = await postMultipart(app, "/applications/package", [
    ...metadataParts({appId: "ignored"}),
    {name: "files", filename: "manifest.xml", content: manifest},
    processPart("alpha"),
  ]);

  expect(response.statusCode).toBe(200);
  expect(response.headers["content-disposition"]).toBe('attachment; filename="application.zip"');
  expect(strFromU8(unzipSync(response.rawPayload)["manifest.xml"])).toBe(manifest);

  await app.close();
});

test("strips paths from uploaded filenames", async () => {
  const {app} = await createApp();

  const response = await postMultipart(app, "/applications/package", [
    ...metadataParts(),
    processPart("alpha", "../nested/alpha.xml"),
  ]);

  expect(response.statusCode).toBe(200);
  expect(Object.keys(unzipSync(response.rawPayload))).toContain("processes/alpha.xml");

  await app.close();
});

test("rejects the validate flag on the one-shot endpoint", async () => {
  const {app} = await createApp();

  const response = await postMultipart(app, "/applications/package", [
    ...metadataParts(),
    {name: "validate", value: "true"},
    processPart("alpha"),
  ]);

  expect(response.statusCode).toBe(400);
  expect(response.json().error).toContain("only supported for batches");

  await app.close();
});

test("rejects multipart fields that exceed the field limit", async () => {
  const {app} = await createApp({maxFieldBytes: 16});

  const response = await postMultipart(app, "/applications/package", [
    {name: "appId", value: "a".repeat(32)},
    {name: "name", value: "App"},
    {name: "version", value: "1.0.0"},
    processPart("alpha"),
  ]);

  expect(response.statusCode).toBe(413);
  expect(response.json().error).toContain("exceeds");

  await app.close();
});

test("rejects missing metadata, malformed XML, non-XML files, and duplicate ids", async () => {
  const {app} = await createApp();

  const missing = await postMultipart(app, "/applications/package", [processPart("alpha")]);
  expect(missing.statusCode).toBe(400);
  expect(missing.json().status).toBe("error");

  const malformed = await postMultipart(app, "/applications/package", [
    ...metadataParts(),
    {name: "files", filename: "bad.xml", content: "<document>"},
  ]);
  expect(malformed.statusCode).toBe(400);

  const nonXml = await postMultipart(app, "/applications/package", [
    ...metadataParts(),
    {name: "files", filename: "notes.txt", content: "<document><id>a</id></document>"},
  ]);
  expect(nonXml.statusCode).toBe(400);

  const duplicate = await postMultipart(app, "/applications/package", [
    ...metadataParts(),
    processPart("same", "a.xml"),
    processPart("same", "b.xml"),
  ]);
  expect(duplicate.statusCode).toBe(409);

  await app.close();
});

test("runs a batch from start through uploads to a finished zip", async () => {
  const {app} = await createApp();

  const started = await postMultipart(app, "/applications/package/batches", metadataParts());
  expect(started.statusCode).toBe(201);
  const {batchId, processCount, validate} = started.json();
  expect(batchId).toBe("batch-1");
  expect(processCount).toBe(0);
  expect(validate).toBe(false);

  const first = await postMultipart(app, `/applications/package/batches/${batchId}/processes`, [processPart("alpha")]);
  expect(first.statusCode).toBe(200);
  expect(first.json()).toMatchObject({batchId, processCount: 1, validate: false});

  const second = await postMultipart(app, `/applications/package/batches/${batchId}/processes`, [processPart("beta")]);
  expect(second.json().processCount).toBe(2);

  const completed = await app.inject({
    method: "POST",
    url: `/applications/package/batches/${batchId}/complete`,
  });
  expect(completed.statusCode).toBe(200);
  expect(Object.keys(unzipSync(completed.rawPayload)).sort())
    .toEqual(["manifest.xml", "processes/alpha.xml", "processes/beta.xml"]);

  const again = await app.inject({
    method: "POST",
    url: `/applications/package/batches/${batchId}/complete`,
  });
  expect(again.statusCode).toBe(404);
  expect(again.json().status).toBe("not_found");

  await app.close();
});

test("reports unknown batches and deletes live ones", async () => {
  const {app} = await createApp();

  expect((await postMultipart(app, "/applications/package/batches/missing/processes", [processPart("a")])).statusCode)
    .toBe(404);
  expect((await app.inject({method: "POST", url: "/applications/package/batches/missing/complete"})).statusCode)
    .toBe(404);
  expect((await app.inject({method: "DELETE", url: "/applications/package/batches/missing"})).statusCode)
    .toBe(404);

  const started = await postMultipart(app, "/applications/package/batches", metadataParts());
  const {batchId} = started.json();
  expect((await app.inject({method: "DELETE", url: `/applications/package/batches/${batchId}`})).statusCode)
    .toBe(204);
  expect((await app.inject({method: "DELETE", url: `/applications/package/batches/${batchId}`})).statusCode)
    .toBe(404);

  await app.close();
});

test("rejects manifest files at batch start and process files after start", async () => {
  const {app} = await createApp();

  const started = await postMultipart(app, "/applications/package/batches", [
    ...metadataParts(),
    processPart("alpha"),
  ]);
  expect(started.statusCode).toBe(400);

  const withManifest = await postMultipart(app, "/applications/package/batches", [
    {name: "files", filename: "manifest.xml", content: "<cases><case/></cases>"},
  ]);
  const batchId = withManifest.json().batchId;

  const manifestUpload = await postMultipart(app, `/applications/package/batches/${batchId}/processes`, [
    {name: "files", filename: "manifest.xml", content: "<cases><case/></cases>"},
  ]);
  expect(manifestUpload.statusCode).toBe(400);

  await app.close();
});

test("expires batches for uploads and completion", async () => {
  let now = 1_000;
  const {app} = await createApp({ttlMs: 100, now: () => now});

  const started = await postMultipart(app, "/applications/package/batches", metadataParts());
  const {batchId} = started.json();
  now += 101;

  expect((await postMultipart(app, `/applications/package/batches/${batchId}/processes`, [processPart("a")])).statusCode)
    .toBe(404);
  expect((await app.inject({method: "POST", url: `/applications/package/batches/${batchId}/complete`})).statusCode)
    .toBe(404);

  await app.close();
});

test("keeps a batch alive when validation outlasts the TTL", async () => {
  let now = 1_000;
  const validator: Validator = async () => {
    now += 101;
    return {valid: true, issues: []};
  };
  const {app} = await createApp({ttlMs: 100, now: () => now, validateProcess: validator});

  const started = await postMultipart(app, "/applications/package/batches", [
    ...metadataParts(),
    {name: "validate", value: "true"},
  ]);
  const {batchId} = started.json();

  const upload = await postMultipart(app, `/applications/package/batches/${batchId}/processes`, [processPart("alpha")]);
  expect(upload.statusCode).toBe(200);

  await app.close();
});

test("completes a batch that started with an uploaded manifest", async () => {
  const {app} = await createApp();
  const manifest = "<cases><case><title>Provided</title></case></cases>\n";

  const started = await postMultipart(app, "/applications/package/batches", [
    {name: "files", filename: "manifest.xml", content: manifest},
  ]);
  const {batchId} = started.json();
  await postMultipart(app, `/applications/package/batches/${batchId}/processes`, [processPart("alpha")]);

  const completed = await app.inject({method: "POST", url: `/applications/package/batches/${batchId}/complete`});
  expect(completed.statusCode).toBe(200);
  expect(strFromU8(unzipSync(completed.rawPayload)["manifest.xml"])).toBe(manifest);

  await app.close();
});

test("caps the number of open batches", async () => {
  const {app} = await createApp({maxBatches: 1});

  expect((await postMultipart(app, "/applications/package/batches", metadataParts())).statusCode).toBe(201);
  expect((await postMultipart(app, "/applications/package/batches", metadataParts())).statusCode).toBe(503);

  await app.close();
});

test("applies route limits to the package builder without a custom store", async () => {
  const {app} = await createAppWithRouteOptionsOnly({maxPackageBytes: 100});

  const started = await postMultipart(app, "/applications/package/batches", metadataParts());
  const {batchId} = started.json();
  expect((await postMultipart(app, `/applications/package/batches/${batchId}/processes`, [processPart("alpha")])).statusCode)
    .toBe(200);

  const completed = await app.inject({method: "POST", url: `/applications/package/batches/${batchId}/complete`});
  expect(completed.statusCode).toBe(413);

  await app.close();
});

test("enforces per-file and aggregate upload limits", async () => {
  const perFile = await createApp({maxFileBytes: 10});
  const fileTooLarge = await postMultipart(perFile.app, "/applications/package", [
    ...metadataParts(),
    {name: "files", filename: "a.xml", content: "<document><id>a</id></document>"},
  ]);
  expect(fileTooLarge.statusCode).toBe(413);
  await perFile.app.close();

  const aggregate = await createApp({maxPackageBytes: 20});
  const totalTooLarge = await postMultipart(aggregate.app, "/applications/package", [
    ...metadataParts(),
    processPart("alpha"),
    processPart("beta"),
  ]);
  expect(totalTooLarge.statusCode).toBe(413);
  await aggregate.app.close();
});

test("validates processes when the batch flag is enabled", async () => {
  const {app, store} = await createApp({validateProcess: invalidValidator()});

  const started = await postMultipart(app, "/applications/package/batches", [
    ...metadataParts(),
    {name: "validate", value: "true"},
  ]);
  expect(started.json().validate).toBe(true);
  const {batchId} = started.json();

  const upload = await postMultipart(app, `/applications/package/batches/${batchId}/processes`, [processPart("alpha")]);
  expect(upload.statusCode).toBe(422);
  expect(upload.json()).toMatchObject({
    status: "invalid",
    batchId,
    issues: [{filename: "alpha.xml", id: "alpha", rule: "xsd", severity: "error"}],
  });
  expect(store.get(batchId)?.processes).toEqual([]);

  await app.close();
});

test("rejects a multi-file upload atomically when one process is invalid", async () => {
  const validator: Validator = async xml => xml.includes("bad")
    ? {valid: false, issues: [{rule: "test", severity: "error", message: "bad process"}]}
    : {valid: true, issues: []};
  const {app, store} = await createApp({validateProcess: validator});

  const started = await postMultipart(app, "/applications/package/batches", [
    ...metadataParts(),
    {name: "validate", value: "true"},
  ]);
  const {batchId} = started.json();

  const upload = await postMultipart(app, `/applications/package/batches/${batchId}/processes`, [
    processPart("good"),
    processPart("bad"),
  ]);
  expect(upload.statusCode).toBe(422);
  expect(store.get(batchId)?.processes).toEqual([]);

  await app.close();
});

test("does not call the validator when the batch flag is off", async () => {
  let calls = 0;
  const validator: Validator = async () => {
    calls++;
    return {valid: false, issues: []};
  };
  const {app} = await createApp({validateProcess: validator});

  const started = await postMultipart(app, "/applications/package/batches", metadataParts());
  const {batchId, validate} = started.json();
  expect(validate).toBe(false);

  const upload = await postMultipart(app, `/applications/package/batches/${batchId}/processes`, [processPart("alpha")]);
  expect(upload.statusCode).toBe(200);
  expect(calls).toBe(0);

  await app.close();
});

test("adds processes that pass validation, including warnings", async () => {
  const validator: Validator = async () => ({
    valid: true,
    issues: [{rule: "style", severity: "warning", message: "minor"}],
  });
  const {app, store} = await createApp({validateProcess: validator});

  const started = await postMultipart(app, "/applications/package/batches", [
    ...metadataParts(),
    {name: "validate", value: "true"},
  ]);
  const {batchId} = started.json();

  const upload = await postMultipart(app, `/applications/package/batches/${batchId}/processes`, [processPart("alpha")]);
  expect(upload.statusCode).toBe(200);
  expect(store.get(batchId)?.processes).toHaveLength(1);

  await app.close();
});

test("rejects an invalid validate flag and reports validator failures", async () => {
  const {app} = await createApp();

  const invalidFlag = await postMultipart(app, "/applications/package/batches", [
    ...metadataParts(),
    {name: "validate", value: "maybe"},
  ]);
  expect(invalidFlag.statusCode).toBe(400);

  const failing = await createApp({
    validateProcess: async () => {
      throw new Error("no Petriflow version available");
    },
  });
  const started = await postMultipart(failing.app, "/applications/package/batches", [
    ...metadataParts(),
    {name: "validate", value: "true"},
  ]);
  const {batchId} = started.json();
  const upload = await postMultipart(failing.app, `/applications/package/batches/${batchId}/processes`, [processPart("alpha")]);
  expect(upload.statusCode).toBe(503);
  expect(upload.json().error).toContain("no Petriflow version available");

  await app.close();
  await failing.app.close();
});
