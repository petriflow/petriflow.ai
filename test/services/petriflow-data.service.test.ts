import {mkdtempSync, rmSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {expect, test} from "vitest";
import {StorageService} from "../../src/ts/services/storage.service";
import {PetriflowDataService} from "../../src/ts/services/petriflow-data.service";

function withData(run: (service: PetriflowDataService) => void): void {
  const directory = mkdtempSync(path.join(os.tmpdir(), "petriflow-data-"));
  try {
    const storage = new StorageService(directory);
    storage.installVersion("1.2.3", {
      "petriflow.schema.xsd": "<schema />",
      "overview.md": "# Overview",
      "actions-definitions.json": JSON.stringify({
        send: {signature: "send()", description: "Send"},
        choose: {alts: [
          {signature: "choose(a)", description: "First"},
          {signature: "choose(b)", description: "Second"},
        ]},
        chain: {dslChain: {then: {signature: "then()", description: "Chain"}}},
      }),
      "elements/place.xsd": "<place />",
      "elements/role.xsd": "<role />",
      "examples/sample.xml": "<process><title> Sample process </title></process>",
    });
    run(new PetriflowDataService(storage, {getLatestVersion: () => "1.2.3"}));
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
    expect(service.listExamples("1.2.3")).toEqual([
      {name: "sample", description: "Sample process"},
    ]);
    expect(service.getExample("1.2.3", "sample")).toBe("<process><title> Sample process </title></process>");
  });
});

test("resolves latest and reports missing release files clearly", () => {
  withData((service) => {
    expect(service.getOverview("latest")).toBe("# Overview");
    expect(() => service.getElement("1.2.3", "missing")).toThrow(/not found/i);
  });
});
