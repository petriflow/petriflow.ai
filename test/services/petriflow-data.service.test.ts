import {mkdtempSync, rmSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {expect, test, vi} from "vitest";
import {StorageService} from "../../src/ts/services/storage.service";
import {PetriflowDataService} from "../../src/ts/services/petriflow-data.service";
import {PetriflowVersionService} from "../../src/ts/services/petriflow-version.service";

function withData(run: (service: PetriflowDataService) => void): void {
  const directory = mkdtempSync(path.join(os.tmpdir(), "petriflow-data-"));
  try {
    const storage = new StorageService(directory);
    storage.installVersion("1.2.3", {
      "petriflow.schema.xsd": "<schema />",
      "overview.md": "# Overview",
      "actions-definitions.json": JSON.stringify({
        send: {signature: "send()", description: "Send"},
        choose: {
          alts: [
            {signature: "choose(a)", description: "First"},
            {signature: "choose(b)", description: "Second"},
          ]
        },
        chain: {dslChain: {then: {signature: "then()", description: "Chain"}}},
      }),
      "components-definitions.json": JSON.stringify({
        "number-currency": {
          names: ["currency"],
          fieldTypes: ["number"],
          description: "Currency",
          whenToUse: "Money",
          params: [{name: "code", type: "string", required: true, description: "Currency code"}],
        },
      }),
      "elements/place.xsd": "<place />",
      "elements/role.xsd": "<role />",
      "examples/sample/manifest.json": JSON.stringify({
        processes: [{
          id: "sample-process",
          description: "Sample process"
        }]
      }),
      "examples/sample/working.xml": "<process><title> Sample process </title></process>",
    });
    run(new PetriflowDataService(storage, {
      resolveVersion: (version) => version === "latest" ? "1.2.3" : version,
    }));
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
}

test("reads schema, overview, elements, actions, and examples from release storage", () => {
  withData((service) => {
    expect(service.getSchemaXsd("1.2.3")).toBe("<schema />");
    expect(service.getOverview("1.2.3")).toBe("# Overview");
    expect(service.listElements("1.2.3")).toEqual([
      {name: "place", description: "Place definition"},
      {name: "role", description: "Role definition"},
    ]);
    expect(service.getElement("1.2.3", "place")).toBe("<place />");
    expect(service.listActions("1.2.3")).toEqual([
      {name: "send", signature: "send()", description: "Send"},
      {name: "choose-0", signature: "choose(a)", description: "First"},
      {name: "choose-1", signature: "choose(b)", description: "Second"},
      {name: "chain-then", signature: "then()", description: "Chain"},
    ]);
    expect(service.getAction("1.2.3", "send")).toEqual({
      name: "send", signature: "send()", description: "Send",
    });
    expect(service.listComponents("1.2.3")).toEqual([
      {
        name: "number-currency", names: ["currency"], fieldTypes: ["number"],
        description: "Currency", whenToUse: "Money",
      },
    ]);
    expect(service.getComponent("1.2.3", "number-currency")).toMatchObject({
      name: "number-currency",
      params: [{name: "code", type: "string", required: true, description: "Currency code"}],
    });
    expect(() => service.getComponent("1.2.3", "missing")).toThrow(/not found/i);
    expect(service.listExamples("1.2.3")).toEqual([
      {name: "sample-process", app: "sample", description: "Sample process"},
    ]);
    expect(service.getExample("1.2.3", "sample", "working"))
      .toBe("<process><title> Sample process </title></process>");
  });
});

test("resolves latest and reports missing release files clearly", () => {
  withData((service) => {
    expect(service.getOverview("latest")).toBe("# Overview");
    expect(() => service.getElement("1.2.3", "missing")).toThrow(/not found/i);
  });
});

test("rejects old stored versions when the LOCAL catalog exposes only its snapshot", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "petriflow-local-data-"));
  try {
    const storage = new StorageService(directory);
    storage.installVersion("1.2.2", {"overview.md": "Old release"});
    storage.installVersion("1.2.3", {"overview.md": "Bundled snapshot"});
    const versions = new PetriflowVersionService({listVersions: () => [], getLatestVersion: () => ""});
    versions.useLocal({version: "1.2.3", releaseDate: "2026-01-01T00:00:00Z"});
    const service = new PetriflowDataService(storage, versions);

    expect(service.getOverview("latest")).toBe("Bundled snapshot");
    expect(() => service.getOverview("1.2.2")).toThrow(/unavailable.*LOCAL/i);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test("shares the default data service across module reloads", async () => {
  const first = (await import("../../src/ts/services/petriflow-data.service")).default;
  vi.resetModules();
  const reloaded = (await import("../../src/ts/services/petriflow-data.service")).default;

  expect(reloaded).toBe(first);
});
