import fs from "node:fs";
import path from "node:path";
import {expect, test} from "vitest";
import {validateComponentsDefinitions, validateReleaseFiles} from "../../src/ts/services/release-files.service";

function releaseFiles(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "petriflow.schema.xsd": "<schema />",
    "overview.md": "# Overview",
    "actions-definitions.json": "{}",
    "elements/place.xsd": "<place />",
    "examples/simple.xml": "<process />",
    ...extra,
  };
}

function component(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    names: ["default"],
    fieldTypes: ["button"],
    description: "Button style",
    whenToUse: "Use for buttons",
    ...overrides,
  };
}

function componentsFile(definitions: Record<string, unknown>): string {
  return JSON.stringify(definitions);
}

test("accepts a release that does not publish component definitions", () => {
  expect(() => validateReleaseFiles(releaseFiles(), "petriflow-v1.0.0.zip")).not.toThrow();
});

test("accepts a well-formed components definitions file", () => {
  const files = releaseFiles({
    "components-definitions.json": componentsFile({
      "button-style": component({
        params: [{name: "align", type: "string", required: false, description: "Alignment"}],
        examples: ["<component><name>default</name></component>"],
      }),
    }),
  });

  expect(() => validateReleaseFiles(files, "petriflow-v1.0.0.zip")).not.toThrow();
});

test("rejects component definitions that are not a JSON object", () => {
  const files = releaseFiles({"components-definitions.json": "[1, 2, 3]"});

  expect(() => validateReleaseFiles(files, "petriflow-v1.0.0.zip"))
    .toThrow(/invalid components-definitions\.json.*object/i);
});

test("rejects malformed component definitions JSON", () => {
  const files = releaseFiles({"components-definitions.json": "{not json"});

  expect(() => validateReleaseFiles(files, "petriflow-v1.0.0.zip"))
    .toThrow(/invalid components-definitions\.json/i);
});

test("rejects a component without names", () => {
  const files = releaseFiles({
    "components-definitions.json": componentsFile({"button-style": component({names: []})}),
  });

  expect(() => validateReleaseFiles(files, "petriflow-v1.0.0.zip"))
    .toThrow(/button-style.*names/i);
});

test("rejects a component without field types", () => {
  const files = releaseFiles({
    "components-definitions.json": componentsFile({"button-style": component({fieldTypes: "button"})}),
  });

  expect(() => validateReleaseFiles(files, "petriflow-v1.0.0.zip"))
    .toThrow(/button-style.*fieldTypes/i);
});

test("rejects a component without a description or when to use guidance", () => {
  const missingDescription = releaseFiles({
    "components-definitions.json": componentsFile({"button-style": component({description: "  "})}),
  });
  const missingWhenToUse = releaseFiles({
    "components-definitions.json": componentsFile({"button-style": component({whenToUse: undefined})}),
  });

  expect(() => validateReleaseFiles(missingDescription, "petriflow-v1.0.0.zip"))
    .toThrow(/button-style.*description/i);
  expect(() => validateReleaseFiles(missingWhenToUse, "petriflow-v1.0.0.zip"))
    .toThrow(/button-style.*whenToUse/i);
});

test("accepts the checked-in snapshot component definitions", () => {
  const content = fs.readFileSync(path.resolve("src/petriflow/snapshot/components-definitions.json"), "utf8");

  expect(() => validateComponentsDefinitions({"components-definitions.json": content}, "Petriflow snapshot"))
    .not.toThrow();
});

test("rejects malformed component params and examples", () => {
  const badParams = releaseFiles({
    "components-definitions.json": componentsFile({"button-style": component({params: "align"})}),
  });
  const badExamples = releaseFiles({
    "components-definitions.json": componentsFile({"button-style": component({examples: [1]})}),
  });

  expect(() => validateReleaseFiles(badParams, "petriflow-v1.0.0.zip"))
    .toThrow(/button-style.*params/i);
  expect(() => validateReleaseFiles(badExamples, "petriflow-v1.0.0.zip"))
    .toThrow(/button-style.*examples/i);
});
