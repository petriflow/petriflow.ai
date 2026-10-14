import {expect, test, vi} from "vitest";
import {getSingleton} from "../../src/ts/services/singleton-registry.service";
import type {PetriflowVersion} from "../../src/ts/services/release-sync.service";
import type {SyncReport} from "../../src/ts/services/release-sync.service";

test("shares REMOTE sync metadata with the reloaded XMCP version catalog", async () => {
  const syncedVersions: PetriflowVersion[] = [];
  const remoteCatalog = {
    listVersions: () => [...syncedVersions],
    getLatestVersion: () => syncedVersions.find(({latest}) => latest)?.version ?? "",
  };
  getSingleton("netgrif.petriflow.ai/release-sync", () => remoteCatalog);

  const versionsModule = await import("../../src/ts/services/petriflow-version.service");
  const runtimeModule = await import("../../src/ts/services/petriflow-runtime.service");
  const initialCatalog = versionsModule.default;
  const syncReport: SyncReport = {
    discoveredVersions: 1,
    downloadedVersions: ["1.2.3"],
    alreadyInstalledVersions: [],
    failedVersions: [],
  };
  const runtime = new runtimeModule.PetriflowRuntimeService(
    {install: () => { throw new Error("LOCAL snapshot must not be installed in REMOTE"); }},
    initialCatalog,
    {sync: async () => {
      syncedVersions.push({version: "1.2.3", releaseDate: "2026-01-01T00:00:00Z", prerelease: false, latest: true});
      return syncReport;
    }},
    () => undefined,
  );

  await runtime.initialize("REMOTE");
  vi.resetModules();
  const reloadedCatalog = (await import("../../src/ts/services/petriflow-version.service")).default;

  expect(reloadedCatalog).toBe(initialCatalog);
  expect(reloadedCatalog.listVersions()).toEqual(syncedVersions);
  expect(reloadedCatalog.getLatestVersion()).toBe("1.2.3");
});
