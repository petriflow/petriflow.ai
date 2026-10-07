import {mkdirSync, mkdtempSync, rmSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {expect, test} from "vitest";
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

    expect(storage.listVersionFiles("1.2.3", "examples")).toEqual(["first.xml", "second.xml"]);
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
