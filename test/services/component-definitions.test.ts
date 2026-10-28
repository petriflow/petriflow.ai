import fs from "node:fs";
import path from "node:path";
import {describe, expect, test} from "vitest";

const definitionsPath = path.resolve("src/petriflow/snapshot/components-definitions.json");

type Definition = {
  names: string[];
  fieldTypes: string[];
  description: string;
  whenToUse: string;
  params: Array<{name: string; type: string; required: boolean; description: string}>;
  examples: string[];
};

describe("snapshot component definitions", () => {
  const definitions = JSON.parse(fs.readFileSync(definitionsPath, "utf8")) as Record<string, Definition>;

  test("every definition is complete", () => {
    for (const [key, definition] of Object.entries(definitions)) {
      expect(definition.names.length, key).toBeGreaterThan(0);
      expect(definition.fieldTypes.length, key).toBeGreaterThan(0);
      expect(definition.description.trim().length, key).toBeGreaterThan(0);
      expect(definition.whenToUse.trim().length, key).toBeGreaterThan(0);
      expect(Array.isArray(definition.params), key).toBe(true);
      expect(definition.examples.length, key).toBeGreaterThan(0);
      for (const param of definition.params) {
        expect(param.name, key).toMatch(/^[A-Za-z]+$/);
        expect(param.description.trim().length, `${key}.${param.name}`).toBeGreaterThan(0);
        expect(typeof param.required, `${key}.${param.name}`).toBe("boolean");
      }
    }
  });

  test("every example is a component element using one of the declared names and known properties", () => {
    for (const [key, definition] of Object.entries(definitions)) {
      const declared = new Set(definition.params.map((param) => param.name));
      for (const example of definition.examples) {
        const name = example.match(/<component><name>([^<]+)<\/name>/)?.[1];
        expect(definition.names, `${key}: ${example}`).toContain(name);
        for (const [, property] of example.matchAll(/<property key=\\?"([^"\\]+)\\?"/g)) {
          expect(declared.has(property), `${key} example uses undeclared property ${property}`).toBe(true);
        }
      }
    }
  });
});
