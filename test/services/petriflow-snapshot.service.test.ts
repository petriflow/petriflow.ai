import {mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {expect, test} from "vitest";
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

test("installs the checked-in version 1.1.0 snapshot", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "petriflow-bundled-snapshot-"));
  try {
    const storage = new StorageService(path.join(directory, "storage"));
    const snapshotPath = path.join(process.cwd(), "src/petriflow/snapshot");
    const manifest = new PetriflowSnapshotService(snapshotPath, storage).install();

    expect(manifest).toEqual({version: "1.1.0", releaseDate: ""});
    expect(storage.listVersionFiles("1.1.0", "elements")).toContain("document.xsd");
    expect(storage.listVersionFiles("1.1.0", "examples")).toContain("skeleton.xml");
    expect(storage.readVersionFile("1.1.0", "actions-definitions.json")).toContain('"make"');
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
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

test("rejects incomplete or invalid release files", () => {
  const invalidFiles: Array<Record<string, string>> = [
    {"petriflow.schema.xsd": ""},
    {"actions-definitions.json": "not-json"},
  ];

  for (const overrides of invalidFiles) {
    withSnapshot((snapshotPath, storage) => {
      expect(() => new PetriflowSnapshotService(snapshotPath, storage).install())
        .toThrow(/snapshot|release/i);
      expect(storage.hasVersion("1.2.3")).toBe(false);
    }, overrides);
  }

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
