import {parseXml} from "libxmljs2";
import {beforeEach, expect, test, vi} from "vitest";
import {actionValidationRule} from "../../../src/ts/services/rules/action-validation.rule";

const mocks = vi.hoisted(() => ({
  validateWithFunctions: vi.fn(),
  validateFunction: vi.fn(),
}));

vi.mock("../../../src/ts/services/action-validation.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/ts/services/action-validation.service")>();
  return {
    ...actual,
    default: {
      validateWithFunctions: mocks.validateWithFunctions,
      validateFunction: mocks.validateFunction,
    },
  };
});

beforeEach(() => {
  mocks.validateWithFunctions.mockReset().mockResolvedValue({valid: true, issues: []});
  mocks.validateFunction.mockReset().mockResolvedValue({valid: true, issues: []});
});

test("checks action references, passes process functions to compilation, and warns on unused functions", async () => {
  const xml = `
    <document>
      <data><id>knownField</id></data>
      <transition><id>knownTransition</id></transition>
      <function name="helper">return 1</function>
      <function name="unused">return 2</function>
      <action id="save">f: f.knownField; t: t.knownTransition; helper()</action>
    </document>
  `;
  const issues = await actionValidationRule.validate(parseXml(xml), {version: "1.2.3", xml});

  expect(mocks.validateWithFunctions).toHaveBeenCalledWith(
    expect.stringContaining("Field f = null"),
    [{name: "helper", body: "return 1"}, {name: "unused", body: "return 2"}],
  );
  expect(mocks.validateFunction).toHaveBeenCalledTimes(2);
  expect(issues).toEqual([
    expect.objectContaining({
      rule: "action-validation",
      severity: "warning",
      message: 'Function "unused" is defined but never called from any action.',
    }),
  ]);
});

test("reports unknown field references and compiler diagnostics with locations", async () => {
  mocks.validateWithFunctions.mockResolvedValue({
    valid: false,
    issues: [{rule: "compile", severity: "error", message: "unknown method", line: 3, column: 5}],
  });
  const xml = `
    <document>
      <action id="bad">value: f.missingField;</action>
    </document>
  `;

  const issues = await actionValidationRule.validate(parseXml(xml), {version: "1.2.3", xml});

  expect(issues).toHaveLength(2);
  expect(issues[0]).toMatchObject({
    rule: "action-validation",
    severity: "error",
    message: expect.stringContaining('Unknown field "missingField"'),
    path: '<action id="bad">',
  });
  expect(issues[1]).toMatchObject({
    severity: "error",
    message: expect.stringContaining('Action "bad" does not compile: unknown method'),
    path: '<action id="bad">',
    line: 3,
    column: 5,
  });
});
