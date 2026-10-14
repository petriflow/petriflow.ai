import {expect, test, vi} from "vitest";
import {PetriflowVersionService} from "../../src/ts/services/petriflow-version.service";

const manifest = {version: "1.2.3", releaseDate: "2026-01-01T00:00:00Z"};

test("delegates version listing and latest to REMOTE", () => {
  const remoteVersions = [{version: "1.2.2", releaseDate: "2025-01-01T00:00:00Z", prerelease: false, latest: true}];
  const versions = new PetriflowVersionService({
    listVersions: () => remoteVersions,
    getLatestVersion: () => "1.2.2",
  });

  expect(versions.listVersions()).toEqual(remoteVersions);
  expect(versions.getLatestVersion()).toBe("1.2.2");
  expect(versions.resolveVersion("1.2.1")).toBe("1.2.1");
});

test("lists only the local snapshot version", () => {
  const versions = new PetriflowVersionService({listVersions: () => [], getLatestVersion: () => ""});
  versions.useLocal(manifest);

  expect(versions.listVersions()).toEqual([{
    version: "1.2.3",
    releaseDate: "2026-01-01T00:00:00Z",
    prerelease: false,
    latest: true,
  }]);
});

test("resolves latest to the local snapshot", () => {
  const versions = new PetriflowVersionService({listVersions: () => [], getLatestVersion: () => ""});
  versions.useLocal(manifest);

  expect(versions.getLatestVersion()).toBe("1.2.3");
  expect(versions.resolveVersion("latest")).toBe("1.2.3");
  expect(versions.resolveVersion("1.2.3")).toBe("1.2.3");
});

test("rejects versions other than the local snapshot", () => {
  const versions = new PetriflowVersionService({listVersions: () => [], getLatestVersion: () => ""});
  versions.useLocal(manifest);

  expect(() => versions.resolveVersion("1.2.2")).toThrow(/unavailable.*LOCAL/i);
});

test("shares local version state across default-service module reloads", async () => {
  const firstModule = await import("../../src/ts/services/petriflow-version.service");
  const first = firstModule.default;
  first.useLocal(manifest);

  try {
    vi.resetModules();
    const reloadedModule = await import("../../src/ts/services/petriflow-version.service");

    expect(reloadedModule.default).toBe(first);
    expect(reloadedModule.default.listVersions()).toEqual([{
      version: "1.2.3",
      releaseDate: "2026-01-01T00:00:00Z",
      prerelease: false,
      latest: true,
    }]);
  } finally {
    first.useRemote();
  }
});
