import {expect, test} from "vitest";
import type {SyncReport} from "../../src/ts/services/release-sync.service";
import {PetriflowRuntimeService} from "../../src/ts/services/petriflow-runtime.service";

const manifest = {version: "1.2.3", releaseDate: "2026-01-01T00:00:00Z"};
const report: SyncReport = {
  discoveredVersions: 1,
  downloadedVersions: [],
  alreadyInstalledVersions: ["1.2.3"],
  failedVersions: [],
};

test("initializes LOCAL from the snapshot without syncing", async () => {
  let installs = 0;
  let localActivations = 0;
  let remoteActivations = 0;
  let syncCalls = 0;
  const runtime = new PetriflowRuntimeService(
    {install: () => { installs++; return manifest; }},
    {useLocal: () => { localActivations++; }, useRemote: () => { remoteActivations++; }},
    {sync: async () => { syncCalls++; return report; }},
    () => undefined,
  );

  await runtime.initialize("LOCAL");

  expect(installs).toBe(1);
  expect(localActivations).toBe(1);
  expect(remoteActivations).toBe(0);
  expect(syncCalls).toBe(0);
});

test("initializes REMOTE by syncing", async () => {
  let remoteActivations = 0;
  let syncCalls = 0;
  const runtime = new PetriflowRuntimeService(
    {install: () => manifest},
    {useLocal: () => undefined, useRemote: () => { remoteActivations++; }},
    {sync: async () => { syncCalls++; return report; }},
    () => undefined,
  );

  await runtime.initialize("REMOTE");

  expect(remoteActivations).toBe(1);
  expect(syncCalls).toBe(1);
});

test("continues REMOTE startup when sync throws", async () => {
  const warnings: Array<{context: unknown; message: string}> = [];
  let localActivations = 0;
  const failure = new Error("GitHub unavailable");
  const runtime = new PetriflowRuntimeService(
    {install: () => manifest},
    {useLocal: () => { localActivations++; }, useRemote: () => undefined},
    {sync: async () => { throw failure; }},
    (context, message) => warnings.push({context, message}),
  );

  await expect(runtime.initialize("REMOTE")).resolves.toBeUndefined();

  expect(localActivations).toBe(0);
  expect(warnings).toEqual([{
    context: {err: failure},
    message: "Petriflow startup synchronization failed; continuing with locally stored releases",
  }]);
});
