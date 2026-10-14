import Fastify from "fastify";
import {expect, test} from "vitest";
import type {SyncReport} from "../../src/ts/services/release-sync.service";
import {registerPetriflowSyncRoute} from "../../src/ts/routes/petriflow-sync.route";

const completeReport: SyncReport = {
  discoveredVersions: 1,
  downloadedVersions: ["1.2.3"],
  alreadyInstalledVersions: [],
  failedVersions: [],
};

test("POST sync returns the report from the shared release synchronizer", async () => {
  const app = Fastify({logger: false});
  let calls = 0;
  registerPetriflowSyncRoute(app, {
    sync: async () => {
      calls++;
      return completeReport;
    },
  });

  const response = await app.inject({method: "POST", url: "/admin/petriflow/sync"});
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({status: "synchronized", ...completeReport});
  expect(calls).toBe(1);
  await app.close();
});

test("returns 409 without syncing when disabled", async () => {
  const app = Fastify({logger: false});
  let calls = 0;
  registerPetriflowSyncRoute(app, {
    sync: async () => {
      calls++;
      return completeReport;
    },
  }, {syncEnabled: false});

  const response = await app.inject({method: "POST", url: "/admin/petriflow/sync"});
  expect(response.statusCode).toBe(409);
  expect(response.json()).toEqual({status: "disabled", error: "Petriflow synchronization is disabled in LOCAL mode"});
  expect(calls).toBe(0);
  await app.close();
});

test("POST sync reports partial release failures with HTTP 503", async () => {
  const app = Fastify({logger: false});
  registerPetriflowSyncRoute(app, {
    sync: async () => ({
      ...completeReport,
      downloadedVersions: [],
      failedVersions: [{version: "1.2.3", message: "asset missing"}],
    }),
  });

  const response = await app.inject({method: "POST", url: "/admin/petriflow/sync"});
  expect(response.statusCode).toBe(503);
  expect(response.json().status).toBe("partial");
  expect(response.json().failedVersions).toEqual([{version: "1.2.3", message: "asset missing"}]);
  await app.close();
});
