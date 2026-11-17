import {readFileSync} from "node:fs";
import path from "node:path";
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

function manifestXml(appId: string, processes: string[] = [`${appId}/process`]): string {
  return `<cases>
\t<case>
\t\t<dataField type="text"><id>app_id</id><value>${appId}</value><version>1</version></dataField>
\t\t<dataField type="caseRef">
\t\t\t<id>processes</id>
\t\t\t<allowedNets>${processes.map(process => `<value>${process}</value>`).join("")}</allowedNets>
\t\t\t<version>1</version>
\t\t</dataField>
\t</case>
</cases>
`;
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

test("parses a cases manifest with its app id and declared processes", () => {
  const manifest = manifestXml("app", ["app/alpha", "app/beta"]);
  const parsed = parseManifestXml(Buffer.from(manifest));

  expect(parsed.xml).toBe(manifest);
  expect(parsed.content.equals(Buffer.from(manifest))).toBe(true);
  expect(parsed.appId).toBe("app");
  expect(parsed.processIds).toEqual(["app/alpha", "app/beta"]);

  expect(packageErrorOf(() => parseManifestXml(Buffer.from("<document><id>x</id></document>"))).statusCode)
    .toBe(400);
});

test("rejects manifests without app_id or with malformed process references", () => {
  expect(packageErrorOf(() => parseManifestXml(Buffer.from("<cases><case/></cases>"))).statusCode)
    .toBe(400);
  expect(packageErrorOf(() => parseManifestXml(Buffer.from(manifestXml("app", ["alpha"])))).statusCode)
    .toBe(400);
  expect(packageErrorOf(() => parseManifestXml(Buffer.from(manifestXml("app", ["other/alpha"])))).statusCode)
    .toBe(400);
  expect(packageErrorOf(() => parseManifestXml(Buffer.from(manifestXml("app", ["app/a", "app/a"])))).statusCode)
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

test("generates a manifest and an application folder for scoped process ids", () => {
  const pkg = buildApplicationPackage({
    metadata: {appId: "app", name: "App", version: "1.0.0"},
    processes: [processFile("alpha.xml", "app/alpha"), processFile("beta.xml", "app/beta")],
  });

  const entries = unzipSync(pkg.archive);
  expect(Object.keys(entries).sort()).toEqual([
    "manifest.xml",
    "processes/app/alpha.xml",
    "processes/app/beta.xml",
  ]);
  expect(strFromU8(entries["manifest.xml"])).toBe(generateAppManifest({
    appId: "app", name: "App", version: "1.0.0", processes: ["app/alpha", "app/beta"],
  }));
  expect(pkg.processIds).toEqual(["app/alpha", "app/beta"]);
});

test("uses a provided manifest verbatim and its app id for the folder", () => {
  const manifest = manifestXml("app", ["app/alpha"]);
  const pkg = buildApplicationPackage({
    manifest: parseManifestXml(Buffer.from(manifest)),
    processes: [processFile("alpha.xml", "app/alpha")],
  });

  expect(pkg.manifestXml).toBe(manifest);
  expect(Buffer.from(unzipSync(pkg.archive)["manifest.xml"]).equals(Buffer.from(manifest))).toBe(true);
  expect(Object.keys(unzipSync(pkg.archive))).toContain("processes/app/alpha.xml");
});

test("rejects a provided manifest whose declared processes do not match the uploads", () => {
  expect(packageErrorOf(() => buildApplicationPackage({
    manifest: parseManifestXml(Buffer.from(manifestXml("app", ["app/alpha", "app/missing"]))),
    processes: [processFile("alpha.xml", "app/alpha")],
  })).statusCode).toBe(400);

  expect(packageErrorOf(() => buildApplicationPackage({
    manifest: parseManifestXml(Buffer.from(manifestXml("app", ["app/alpha"]))),
    processes: [processFile("alpha.xml", "app/alpha"), processFile("extra.xml", "app/extra")],
  })).statusCode).toBe(400);
});

test("rejects plain ids and ids scoped to another application", () => {
  const metadata = {appId: "app", name: "App", version: "1.0.0"};

  expect(packageErrorOf(() => buildApplicationPackage({
    metadata,
    processes: [processFile("alpha.xml", "alpha")],
  })).statusCode).toBe(400);

  expect(packageErrorOf(() => buildApplicationPackage({
    metadata,
    processes: [processFile("alpha.xml", "other/alpha")],
  })).statusCode).toBe(400);

  expect(packageErrorOf(() => buildApplicationPackage({
    metadata: {appId: "../app", name: "App", version: "1"},
    processes: [processFile("alpha.xml", "../app/alpha")],
  })).statusCode).toBe(400);
});

test("rejects duplicate process ids", () => {
  expect(packageErrorOf(() => buildApplicationPackage({
    metadata: {appId: "app", name: "App", version: "1.0.0"},
    processes: [processFile("a.xml", "app/same"), processFile("b.xml", "app/same")],
  })).statusCode).toBe(409);
});

test("allows the same uploaded basename for different process ids", () => {
  const pkg = buildApplicationPackage({
    metadata: {appId: "app", name: "App", version: "1.0.0"},
    processes: [processFile("same.xml", "app/one"), processFile("same.xml", "app/two")],
  });

  expect(Object.keys(unzipSync(pkg.archive)).sort()).toEqual([
    "manifest.xml",
    "processes/app/one.xml",
    "processes/app/two.xml",
  ]);
});

test("requires processes and a manifest source", () => {
  expect(packageErrorOf(() => buildApplicationPackage({
    metadata: {appId: "app", name: "App", version: "1"},
    processes: [],
  })).statusCode).toBe(400);
  expect(packageErrorOf(() => buildApplicationPackage({
    processes: [processFile("a.xml", "app/a")],
  })).statusCode).toBe(400);
});

test("enforces the package size limit", () => {
  expect(packageErrorOf(() => buildApplicationPackage(
    {metadata: {appId: "app", name: "App", version: "1"}, processes: [processFile("a.xml", "app/a")]},
    {maxPackageBytes: 10},
  )).statusCode).toBe(413);
});

test("reproduces the valid NAE 7 fixture layout", () => {
  const fixture = unzipSync(readFileSync(path.join(__dirname, "../fixtures/test-nae7-app.zip")));
  const manifest = parseManifestXml(Buffer.from(fixture["manifest.xml"]));
  const process = parseProcessXml(
    "user_ASK.xml",
    Buffer.from(fixture["processes/Objednavky/user_ASK.xml"]),
  );

  const pkg = buildApplicationPackage({manifest, processes: [process]});
  const entries = unzipSync(pkg.archive);

  expect(Object.keys(entries).sort()).toEqual([
    "manifest.xml",
    "processes/Objednavky/user_ASK.xml",
  ]);
  expect(Buffer.from(entries["manifest.xml"]).equals(Buffer.from(fixture["manifest.xml"]))).toBe(true);
});
