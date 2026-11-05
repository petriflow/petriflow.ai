import {expect, test} from "vitest";
import {strFromU8, unzipSync} from "fflate";
import {generateAppManifest} from "../../src/ts/services/app-manifest.service";
import {
  buildApplicationPackage,
  PackageError,
  parseManifestXml,
  parseProcessXml,
} from "../../src/ts/services/app-packaging.service";

function processXml(id: string): string {
  return `<document><id>${id}</id><initials>${id.toUpperCase()}</initials></document>`;
}

function processFile(name: string, id: string) {
  return parseProcessXml(name, Buffer.from(processXml(id)));
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

test("parses a process XML and keeps only the basename", () => {
  const file = parseProcessXml("../nested/alpha.xml", Buffer.from(processXml("alpha")));
  expect(file.name).toBe("alpha.xml");
  expect(file.id).toBe("alpha");
  expect(Buffer.isBuffer(file.content)).toBe(true);
});

test("rejects malformed process XML", () => {
  expect(packageErrorOf(() => parseProcessXml("bad.xml", Buffer.from("<document>"))).statusCode)
    .toBe(400);
});

test("rejects a process XML without an id", () => {
  expect(packageErrorOf(() => parseProcessXml("no-id.xml", Buffer.from("<document><initials>X</initials></document>"))).statusCode)
    .toBe(400);
});

test("rejects non-XML uploads and manifest.xml as a process", () => {
  expect(packageErrorOf(() => parseProcessXml("notes.txt", Buffer.from(processXml("alpha")))).statusCode)
    .toBe(400);
  expect(packageErrorOf(() => parseProcessXml("manifest.xml", Buffer.from(processXml("alpha")))).statusCode)
    .toBe(400);
});

test("accepts a cases manifest and rejects other roots", () => {
  const manifest = "<cases><case><title>App</title></case></cases>\n";
  const parsed = parseManifestXml(Buffer.from(manifest));
  expect(parsed.xml).toBe(manifest);
  expect(parsed.content.equals(Buffer.from(manifest))).toBe(true);
  expect(packageErrorOf(() => parseManifestXml(Buffer.from("<document><id>x</id></document>"))).statusCode)
    .toBe(400);
});

test("accepts a UTF-8 BOM and rejects non-UTF-8 encodings", () => {
  const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(processXml("alpha"))]);
  expect(parseProcessXml("alpha.xml", withBom).id).toBe("alpha");

  const latin1 = Buffer.from("<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?><document><id>caf\xe9</id></document>", "binary");
  expect(packageErrorOf(() => parseProcessXml("latin1.xml", latin1)).statusCode).toBe(400);

  const utf16 = Buffer.from([0xff, 0xfe, 0x3c, 0x00, 0x64, 0x00]);
  expect(packageErrorOf(() => parseProcessXml("utf16.xml", utf16)).statusCode).toBe(400);
  expect(packageErrorOf(() => parseManifestXml(latin1)).statusCode).toBe(400);
});

test("rejects a process whose root is not document", () => {
  expect(packageErrorOf(() => parseProcessXml(
    "sneaky.xml",
    Buffer.from("<cases><case><dataField><id>app_id</id></dataField></case></cases>"),
  )).statusCode).toBe(400);
});

test("generates a manifest and zip entries from process ids", () => {
  const pkg = buildApplicationPackage({
    metadata: {appId: "app", name: "App", version: "1.0.0"},
    processes: [processFile("alpha.xml", "alpha"), processFile("beta.xml", "beta")],
  });

  const entries = unzipSync(pkg.archive);
  expect(Object.keys(entries).sort()).toEqual(["manifest.xml", "processes/alpha.xml", "processes/beta.xml"]);
  expect(strFromU8(entries["manifest.xml"])).toBe(generateAppManifest({
    appId: "app", name: "App", version: "1.0.0", processes: ["alpha", "beta"],
  }));
  expect(pkg.processIds).toEqual(["alpha", "beta"]);
});

test("uses a provided manifest verbatim", () => {
  const manifest = "<cases><case><title>Provided</title></case></cases>\n";
  const pkg = buildApplicationPackage({
    manifest: parseManifestXml(Buffer.from(manifest)),
    metadata: {appId: "ignored", name: "Ignored", version: "1"},
    processes: [processFile("alpha.xml", "alpha")],
  });

  expect(pkg.manifestXml).toBe(manifest);
  expect(strFromU8(unzipSync(pkg.archive)["manifest.xml"])).toBe(manifest);
  expect(Buffer.from(unzipSync(pkg.archive)["manifest.xml"]).equals(Buffer.from(manifest))).toBe(true);
});

test("rejects duplicate process ids and duplicate filenames", () => {
  const metadata = {appId: "app", name: "App", version: "1.0.0"};
  expect(packageErrorOf(() => buildApplicationPackage({
    metadata,
    processes: [processFile("a.xml", "same"), processFile("b.xml", "same")],
  })).statusCode).toBe(409);

  expect(packageErrorOf(() => buildApplicationPackage({
    metadata,
    processes: [processFile("a.xml", "one"), processFile("a.xml", "two")],
  })).statusCode).toBe(409);
});

test("requires processes and a manifest source", () => {
  expect(packageErrorOf(() => buildApplicationPackage({metadata: {appId: "app", name: "App", version: "1"}, processes: []})).statusCode)
    .toBe(400);
  expect(packageErrorOf(() => buildApplicationPackage({processes: [processFile("a.xml", "a")]})).statusCode)
    .toBe(400);
});

test("enforces the package size limit", () => {
  expect(packageErrorOf(() => buildApplicationPackage(
    {metadata: {appId: "app", name: "App", version: "1"}, processes: [processFile("a.xml", "a")]},
    {maxPackageBytes: 10},
  )).statusCode).toBe(413);
});
