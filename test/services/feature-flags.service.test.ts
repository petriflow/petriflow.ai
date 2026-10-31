import {expect, test} from "vitest";
import {createFeatureFlags, withToolFeatureFlag} from "../../src/ts/services/feature-flags.service";

test("enables every rule and tool when disabled-name lists are unset or blank", () => {
  const unset = createFeatureFlags({});
  const blank = createFeatureFlags({
    PETRIFLOW_DISABLED_RULES: " , ",
    PETRIFLOW_DISABLED_TOOLS: "  "
  });

  expect(unset.isRuleEnabled("action-validation")).toBe(true);
  expect(unset.isToolEnabled("validate_action")).toBe(true);
  expect(blank.isRuleEnabled("action-validation")).toBe(true);
  expect(blank.isToolEnabled("validate_action")).toBe(true);
});

test("disables exact comma-separated names after trimming whitespace and duplicates", () => {
  const flags = createFeatureFlags({
    PETRIFLOW_DISABLED_RULES: " action-validation, , action-validation ",
    PETRIFLOW_DISABLED_TOOLS: "get_overview, validate_action"
  });

  expect(flags.isRuleEnabled("action-validation")).toBe(false);
  expect(flags.isRuleEnabled("unique-ids")).toBe(true);
  expect(flags.isToolEnabled("get_overview")).toBe(false);
  expect(flags.isToolEnabled("validate_action")).toBe(false);
  expect(flags.isToolEnabled("get_schema")).toBe(true);
});

test("reports disabled names that are not registered features", () => {
  const flags = createFeatureFlags({
    PETRIFLOW_DISABLED_RULES: "unknown-rule",
    PETRIFLOW_DISABLED_TOOLS: "unknown-tool"
  });

  expect(flags.unknownRuleNames(["unique-ids", "action-validation"])).toEqual(["unknown-rule"]);
  expect(flags.unknownToolNames(["get_schema", "validate_action"])).toEqual(["unknown-tool"]);
});

test("adds XMCP enabled metadata according to the tool flag", () => {
  const flags = createFeatureFlags({PETRIFLOW_DISABLED_TOOLS: "get_overview"});

  expect(withToolFeatureFlag({name: "get_overview", description: "Overview"}, flags)).toEqual({
    name: "get_overview",
    description: "Overview",
    enabled: false
  });
  expect(withToolFeatureFlag({name: "get_schema"}, flags).enabled).toBe(true);
});
