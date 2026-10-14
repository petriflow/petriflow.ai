import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {expect, test, vi} from "vitest";
import {StorageService} from "../../src/ts/services/storage.service";

function withStorage(run: (storage: StorageService) => void): void {
  const directory = mkdtempSync(path.join(os.tmpdir(), "petriflow-storage-"));
  try {
    run(new StorageService(directory));
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
}

test("installs and reads release files by version", () => {
  withStorage((storage) => {
    const installed = storage.installVersion("1.2.3", {
      "petriflow.schema.xsd": "<schema />",
      "elements/place.xsd": "<element />",
    });

    expect(installed).toBe(true);
    expect(storage.readVersionFile("1.2.3", "petriflow.schema.xsd")).toBe("<schema />");
    expect(storage.readVersionFile("1.2.3", "elements/place.xsd")).toBe("<element />");
    expect(storage.listInstalledVersions()).toEqual(["1.2.3"]);
    expect(new StorageService(storage.storagePath).hasVersion("1.2.3")).toBe(true);
  });
});

test("shares the default storage service across module reloads", async () => {
  const first = (await import("../../src/ts/services/storage.service")).default;
  vi.resetModules();
  const reloaded = (await import("../../src/ts/services/storage.service")).default;

  expect(reloaded).toBe(first);
});

test("installs files from a directory without changing binary contents", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "petriflow-storage-paths-"));
  try {
    const sourcePath = path.join(directory, "snapshot");
    const binaryPath = path.join(sourcePath, "assets", "binary.dat");
    const binary = Buffer.from([0xff, 0x00, 0x81]);
    mkdirSync(path.dirname(binaryPath), {recursive: true});
    writeFileSync(binaryPath, binary);
    const storage = new StorageService(path.join(directory, "storage"));

    expect(storage.installVersionFromDirectory("1.2.3", sourcePath, ["assets/binary.dat"])).toBe(true);
    expect(readFileSync(path.join(storage.storagePath, "1.2.3", "assets", "binary.dat"))).toEqual(binary);
    expect(storage.hasVersion("1.2.3")).toBe(true);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test("rejects unsafe paths when installing from a directory", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "petriflow-storage-paths-"));
  try {
    const sourcePath = path.join(directory, "snapshot");
    mkdirSync(sourcePath);
    const storage = new StorageService(path.join(directory, "storage"));

    expect(() => storage.installVersionFromDirectory("1.2.3", sourcePath, ["../outside.dat"]))
      .toThrow(/Invalid release file path/);
    expect(storage.hasVersion("1.2.3")).toBe(false);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test("does not overwrite an installed release", () => {
  withStorage((storage) => {
    storage.installVersion("1.2.3", {"overview.md": "original"});

    const installed = storage.installVersion("1.2.3", {"overview.md": "replacement"});

    expect(installed).toBe(false);
    expect(storage.readVersionFile("1.2.3", "overview.md")).toBe("original");
  });
});

test("does not report an incomplete pre-existing directory as installed", () => {
  withStorage((storage) => {
    mkdirSync(path.join(storage.storagePath, "1.2.3"));

    expect(() => storage.installVersion("1.2.3", {"overview.md": "overview"}))
      .toThrow(/incomplete release directory/i);
    expect(storage.hasVersion("1.2.3")).toBe(false);
  });
});

test("lists files in a version directory", () => {
  withStorage((storage) => {
    storage.installVersion("1.2.3", {
      "examples/second.xml": "second",
      "examples/first.xml": "first",
      "elements/place.xsd": "place",
    });
    mkdirSync(path.join(storage.storagePath, "1.2.3", "examples", "nested"));

    expect(storage.listVersionFiles("1.2.3", "examples")).toEqual([
      path.join(storage.storagePath, "1.2.3", "examples", "first.xml"),
      path.join(storage.storagePath, "1.2.3", "examples", "nested"),
      path.join(storage.storagePath, "1.2.3", "examples", "second.xml"),
    ]);
    expect(storage.listVersionFiles("1.2.3", "missing")).toEqual([]);
  });
});

test("ignores abandoned temporary directories when listing installed releases", () => {
  withStorage((storage) => {
    storage.installVersion("1.2.3", {"overview.md": "overview"});
    mkdirSync(path.join(storage.storagePath, ".tmp-interrupted-install"));

    expect(storage.listInstalledVersions()).toEqual(["1.2.3"]);
  });
});

test("rejects unsafe version and file paths", () => {
  withStorage((storage) => {
    expect(() => storage.installVersion("../outside", {"file.txt": "bad"})).toThrow(/Invalid release version/);
    expect(() => storage.installVersion("1.2.3", {"../outside.txt": "bad"})).toThrow(/Invalid release file path/);
    expect(() => storage.readVersionFile("1.2.3", "../../outside.txt")).toThrow(/Invalid release file path/);
  });
});
