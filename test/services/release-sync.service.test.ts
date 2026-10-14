import {mkdtempSync, rmSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {strToU8, zipSync} from "fflate";
import {expect, test, vi} from "vitest";
import {StorageService} from "../../src/ts/services/storage.service";
import {ReleaseSyncService} from "../../src/ts/services/release-sync.service";

const RELEASES_URL = "https://api.github.com/repos/petriflow/petriflow/releases";

class MemoryCache {
  values = new Map<string, unknown>();

  get(key: string): unknown {
    return this.values.get(key);
  }

  set(key: string, value: unknown): void {
    this.values.set(key, value);
  }
}

function makeZip(): Uint8Array {
  return zipSync({
    "petriflow.schema.xsd": strToU8("<schema />"),
    "overview.md": strToU8("Overview"),
    "actions-definitions.json": strToU8("{}"),
    "elements/place.xsd": strToU8("<element />"),
    "examples/simple.xml": strToU8("<process />"),
  });
}

function release(tag: string, assetName = `petriflow-${tag}.zip`) {
  return {
    tag_name: tag,
    draft: false,
    prerelease: tag.includes("-"),
    published_at: "2026-01-01T00:00:00Z",
    assets: [{name: assetName, browser_download_url: `https://github.com/petriflow/petriflow/releases/download/${tag}/${assetName}`}],
  };
}

function withService(
  releases: unknown[],
  archives: Record<string, Uint8Array>,
  run: (service: ReleaseSyncService, storage: StorageService, calls: string[]) => Promise<void>,
): Promise<void> {
  const directory = mkdtempSync(path.join(os.tmpdir(), "petriflow-release-"));
  const storage = new StorageService(path.join(directory, "storage"));
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith(RELEASES_URL)) {
      return new Response(JSON.stringify(url.includes("page=1") ? releases : []), {status: 200});
    }
    const archive = archives[url];
    return archive
      ? new Response(archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer, {status: 200})
      : new Response("missing archive", {status: 404});
  };
  const service = new ReleaseSyncService({fetcher, storage, cache: new MemoryCache()});
  return run(service, storage, calls).finally(() => rmSync(directory, {recursive: true, force: true}));
}

test("downloads and installs only missing release ZIPs", async () => {
  const archive = makeZip();
  const assetUrl = "https://github.com/petriflow/petriflow/releases/download/v1.2.3/petriflow-v1.2.3.zip";
  await withService([release("v1.2.3")], {[assetUrl]: archive}, async (service, storage, calls) => {
    const first = await service.sync();
    const second = await service.sync();

    expect(first.downloadedVersions).toEqual(["1.2.3"]);
    expect(first.failedVersions).toEqual([]);
    expect(second.alreadyInstalledVersions).toEqual(["1.2.3"]);
    expect(calls.filter((url) => url === assetUrl).length).toBe(1);
    expect(storage.readVersionFile("1.2.3", "overview.md")).toBe("Overview");
  });
});

test("keeps successful releases when another archive is invalid", async () => {
  const validUrl = "https://github.com/petriflow/petriflow/releases/download/v1.2.3/petriflow-v1.2.3.zip";
  const invalidUrl = "https://github.com/petriflow/petriflow/releases/download/v1.2.4/petriflow-v1.2.4.zip";
  await withService(
    [release("v1.2.3"), release("v1.2.4")],
    {[validUrl]: makeZip(), [invalidUrl]: strToU8("not a zip")},
    async (service, storage) => {
      const report = await service.sync();

      expect(report.downloadedVersions).toEqual(["1.2.3"]);
      expect(report.failedVersions).toHaveLength(1);
      expect(report.failedVersions[0].version).toBe("1.2.4");
      expect(storage.hasVersion("1.2.3")).toBe(true);
      expect(storage.hasVersion("1.2.4")).toBe(false);
    },
  );
});

test("caches release metadata and identifies the latest stable version", async () => {
  const archive = makeZip();
  const stableAsset = "https://github.com/petriflow/petriflow/releases/download/v1.2.3/petriflow-v1.2.3.zip";
  const prereleaseAsset = "https://github.com/petriflow/petriflow/releases/download/v2.0.0-rc.1/petriflow-v2.0.0-rc.1.zip";
  await withService(
    [release("v2.0.0-rc.1"), release("v1.2.3")],
    {[stableAsset]: archive, [prereleaseAsset]: archive},
    async (service) => {
      const report = await service.sync();

      expect(report.failedVersions).toEqual([]);
      expect(service.getLatestVersion()).toBe("1.2.3");
      expect(service.listVersions()).toEqual([
        {version: "2.0.0-rc.1", releaseDate: "2026-01-01T00:00:00Z", prerelease: true, latest: false},
        {version: "1.2.3", releaseDate: "2026-01-01T00:00:00Z", prerelease: false, latest: true},
      ]);
    },
  );
});

test("shares the default release synchronizer across module reloads", async () => {
  const first = (await import("../../src/ts/services/release-sync.service")).default;
  vi.resetModules();
  const reloaded = (await import("../../src/ts/services/release-sync.service")).default;

  expect(reloaded).toBe(first);
});
