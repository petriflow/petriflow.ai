import {expect, test} from "vitest";
import {createFeatureFlags} from "../../../src/ts/services/feature-flags.service";
import {getEnabledRules, rules} from "../../../src/ts/services/rules";

test("keeps every validation rule enabled by default", () => {
  expect(getEnabledRules().map(rule => rule.name)).toEqual(rules.map(rule => rule.name));
});

test("filters disabled rules without mutating the full rule catalog", () => {
  const flags = createFeatureFlags({PETRIFLOW_DISABLED_RULES: " action-validation, "});
  const enabledRules = getEnabledRules(flags);

  expect(enabledRules.map(rule => rule.name)).not.toContain("action-validation");
  expect(enabledRules.map(rule => rule.name)).toContain("unique-ids");
  expect(rules.map(rule => rule.name)).toContain("action-validation");
});
