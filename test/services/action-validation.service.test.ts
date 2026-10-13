import {expect, test} from "vitest";
import {extractFieldRefs, normalizeFieldRefs} from "../../src/ts/services/action-validation.service";

test("extracts field and transition references with their local names", () => {
  expect(extractFieldRefs("field: f.fieldId, transition:t.transitionId, other: f.otherId;"))
    .toEqual([
      {name: "field", kind: "f", id: "fieldId"},
      {name: "transition", kind: "t", id: "transitionId"},
      {name: "other", kind: "f", id: "otherId"},
    ]);
});

test("normalizes field and transition references into typed local declarations", () => {
  expect(normalizeFieldRefs("field: f.fieldId, transition: t.transitionId, other: f.otherId;"))
    .toBe("Field field = null\n Transition transition = null\n Field other = null\n");
});

test("leaves source without references unchanged", () => {
  const source = "return 42";
  expect(extractFieldRefs(source)).toEqual([]);
  expect(normalizeFieldRefs(source)).toBe(source);
});
