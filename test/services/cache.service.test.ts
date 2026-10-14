import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {expect, test, vi} from "vitest";
import {CacheService} from "../../src/ts/services/cache.service";

function withCache(run: (cacheFile: string) => void): void {
  const directory = mkdtempSync(path.join(os.tmpdir(), "petriflow-cache-"));
  try {
    run(path.join(directory, "cache.json"));
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
}

test("starts empty and reports the keys stored in the cache", () => {
  withCache((cacheFile) => {
    writeFileSync(cacheFile, JSON.stringify({existing: true}));
    const cache = new CacheService(cacheFile);

    expect(cache.get("existing")).toBe(true);
    expect(cache.get("missing")).toBeUndefined();
  });
});

test("persists values across instances and removes deleted keys", () => {
  withCache((cacheFile) => {
    const cache = new CacheService(cacheFile);
    expect(cache.status()).toEqual({dataCount: 0, dataKeys: []});
    cache.set("versions", ["1.2.3"]);
    cache.set("latestVersion", "1.2.3");

    expect(existsSync(cacheFile)).toBe(true);
    expect(JSON.parse(readFileSync(cacheFile, "utf-8"))).toEqual({
      versions: ["1.2.3"],
      latestVersion: "1.2.3",
    });

    const reopened = new CacheService(cacheFile);
    expect(reopened.get("versions")).toEqual(["1.2.3"]);
    expect(reopened.status()).toEqual({dataCount: 2, dataKeys: ["versions", "latestVersion"]});

    reopened.delete("versions");
    expect(new CacheService(cacheFile).status()).toEqual({dataCount: 1, dataKeys: ["latestVersion"]});
  });
});

test("shares the default cache across module reloads", async () => {
  const first = (await import("../../src/ts/services/cache.service")).default;
  vi.resetModules();
  const reloaded = (await import("../../src/ts/services/cache.service")).default;

  expect(reloaded).toBe(first);
});
