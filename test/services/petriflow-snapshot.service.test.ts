import {mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {expect, test, vi} from "vitest";
import {StorageService} from "../../src/ts/services/storage.service";
import {PetriflowSnapshotService} from "../../src/ts/services/petriflow-snapshot.service";

const releaseFiles: Record<string, string> = {
  "petriflow.schema.xsd": "<schema />",
  "overview.md": "Petriflow overview",
  "actions-definitions.json": "{}",
  "elements/place.xsd": "<element />",
  "examples/simple.xml": "<process />",
};

function withSnapshot(
  run: (snapshotPath: string, storage: StorageService) => void,
  overrides: Record<string, string> = {},
  manifest: Record<string, unknown> = {version: "1.2.3", releaseDate: "2026-01-01T00:00:00Z"},
): void {
  const directory = mkdtempSync(path.join(os.tmpdir(), "petriflow-snapshot-"));
  const snapshotPath = path.join(directory, "snapshot");
  mkdirSync(snapshotPath, {recursive: true});
  writeFileSync(path.join(snapshotPath, "manifest.json"), JSON.stringify(manifest));
  const files = {...releaseFiles, ...overrides};
  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(snapshotPath, relativePath);
    mkdirSync(path.dirname(filePath), {recursive: true});
    writeFileSync(filePath, contents);
  }
  const storage = new StorageService(path.join(directory, "storage"));
  try {
    run(snapshotPath, storage);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
}

test("installs a valid manifest and release dataset", () => {
  withSnapshot((snapshotPath, storage) => {
    const manifest = new PetriflowSnapshotService(snapshotPath, storage).install();

    expect(manifest).toEqual({version: "1.2.3", releaseDate: "2026-01-01T00:00:00Z"});
    expect(storage.readVersionFile("1.2.3", "petriflow.schema.xsd")).toBe("<schema />");
    expect(storage.readVersionFile("1.2.3", "examples/simple.xml")).toBe("<process />");
    expect(storage.hasVersion("1.2.3")).toBe(true);
  });
});

test("accepts snapshots with no published release date", () => {
  withSnapshot((snapshotPath, storage) => {
    const manifest = new PetriflowSnapshotService(snapshotPath, storage).install();
    expect(manifest.releaseDate).toBe("");
  }, {}, {version: "1.2.3"});
});

test("installs the checked-in snapshot including binary assets", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "petriflow-bundled-snapshot-"));
  try {
    const storage = new StorageService(path.join(directory, "storage"));
    const snapshotPath = path.join(process.cwd(), "src/petriflow/snapshot");
    const expectedManifest = JSON.parse(readFileSync(path.join(snapshotPath, "manifest.json"), "utf8"));
    const manifest = new PetriflowSnapshotService(snapshotPath, storage).install();

    expect(manifest).toEqual(expectedManifest);
    expect(storage.listVersionFiles(manifest.version, "elements").map((file) => path.basename(file)))
      .toContain("document.xsd");
    expect(storage.readVersionFile(manifest.version, "actions-definitions.json")).toContain('"make"');
    expect(readFileSync(path.join(storage.storagePath, manifest.version, "examples/routing/assets/routing.png")))
      .toEqual(readFileSync(path.join(snapshotPath, "examples/routing/assets/routing.png")));
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test("copies non-UTF-8 snapshot files without decoding them", () => {
  const binaryContents = Buffer.from([0xff, 0x00, 0x81, 0x42]);
  withSnapshot((snapshotPath, storage) => {
    const sourcePath = path.join(snapshotPath, "assets", "sample.bin");
    mkdirSync(path.dirname(sourcePath), {recursive: true});
    writeFileSync(sourcePath, binaryContents);

    new PetriflowSnapshotService(snapshotPath, storage).install();

    const installedPath = path.join(storage.storagePath, "1.2.3", "assets", "sample.bin");
    expect(readFileSync(installedPath)).toEqual(binaryContents);
  });
});

test("validates snapshot release files by path without parsing their contents", () => {
  withSnapshot((snapshotPath, storage) => {
    writeFileSync(path.join(snapshotPath, "actions-definitions.json"), "not JSON but present");

    expect(() => new PetriflowSnapshotService(snapshotPath, storage).install()).not.toThrow();
    expect(storage.readVersionFile("1.2.3", "actions-definitions.json")).toBe("not JSON but present");
  });
});

test("rejects invalid manifest version or release date", () => {
  for (const manifest of [
    {version: "not-semver", releaseDate: "2026-01-01T00:00:00Z"},
    {version: "1.2.3", releaseDate: "not-a-date"},
  ]) {
    withSnapshot((snapshotPath, storage) => {
      expect(() => new PetriflowSnapshotService(snapshotPath, storage).install())
        .toThrow(/manifest/i);
      expect(storage.hasVersion("1.2.3")).toBe(false);
    }, {}, manifest);
  }
});

test("rejects missing required snapshot paths", () => {
  withSnapshot((snapshotPath, storage) => {
    rmSync(path.join(snapshotPath, "petriflow.schema.xsd"));
    expect(() => new PetriflowSnapshotService(snapshotPath, storage).install())
      .toThrow(/schema/i);
    expect(storage.hasVersion("1.2.3")).toBe(false);
  });

  withSnapshot((snapshotPath, storage) => {
    rmSync(path.join(snapshotPath, "actions-definitions.json"));
    expect(() => new PetriflowSnapshotService(snapshotPath, storage).install())
      .toThrow(/actions-definitions/i);
    expect(storage.hasVersion("1.2.3")).toBe(false);
  });

  withSnapshot((snapshotPath, storage) => {
    rmSync(path.join(snapshotPath, "elements"), {recursive: true, force: true});
    expect(() => new PetriflowSnapshotService(snapshotPath, storage).install())
      .toThrow(/element/i);
    expect(storage.hasVersion("1.2.3")).toBe(false);
  });

  withSnapshot((snapshotPath, storage) => {
    rmSync(path.join(snapshotPath, "examples"), {recursive: true, force: true});
    expect(() => new PetriflowSnapshotService(snapshotPath, storage).install())
      .toThrow(/examples/i);
    expect(storage.hasVersion("1.2.3")).toBe(false);
  });
});

test("rejects unsafe snapshot paths", () => {
  withSnapshot((snapshotPath, storage) => {
    const externalFile = path.join(path.dirname(snapshotPath), "outside.xsd");
    writeFileSync(externalFile, "<external />");
    rmSync(path.join(snapshotPath, "elements", "place.xsd"));
    symlinkSync(externalFile, path.join(snapshotPath, "elements", "place.xsd"));

    expect(() => new PetriflowSnapshotService(snapshotPath, storage).install())
      .toThrow(/symbolic link|unsafe/i);
    expect(storage.hasVersion("1.2.3")).toBe(false);
  });
});

test("shares the default snapshot service across module reloads", async () => {
  const first = (await import("../../src/ts/services/petriflow-snapshot.service")).default;
  vi.resetModules();
  const reloaded = (await import("../../src/ts/services/petriflow-snapshot.service")).default;

  expect(reloaded).toBe(first);
});
