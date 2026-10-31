import type {ValidationRule} from "../validation.service";
import {uniqueIdsRule} from "./unique-ids.rule";
import {uniqueActionIdsRule} from "./unique-action-ids.rule";
import {validIdentifiersRule} from "./valid-identifiers.rule";
import {validVersionRule} from "./valid-version.rule";
import {arcConnectivityRule} from "./arc-connectivity.rule";
import {arcDirectionRule} from "./arc-direction.rule";
import {placeTokensRule} from "./place-tokens.rule";
import {actionValidationRule} from "./action-validation.rule";
import {featureFlags, type FeatureFlags} from "../feature-flags.service";

/**
 * All semantic validation rules, registered with the {@link ValidationService}
 * during startup.
 */
export const rules: ValidationRule[] = [
  uniqueIdsRule,
  uniqueActionIdsRule,
  validIdentifiersRule,
  validVersionRule,
  arcConnectivityRule,
  arcDirectionRule,
  placeTokensRule,
  actionValidationRule
];

/** Filter the complete catalog for startup registration without mutating it. */
export function getEnabledRules(flags: Pick<FeatureFlags, "isRuleEnabled"> = featureFlags): ValidationRule[] {
  return rules.filter(rule => flags.isRuleEnabled(rule.name));
}
