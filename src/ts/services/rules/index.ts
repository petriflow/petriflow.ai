import type {ValidationRule} from "../validation.service";
import {uniqueIdsRule} from "./unique-ids.rule";
import {uniqueActionIdsRule} from "./unique-action-ids.rule";
import {validIdentifiersRule} from "./valid-identifiers.rule";
import {validVersionRule} from "./valid-version.rule";
import {arcConnectivityRule} from "./arc-connectivity.rule";
import {arcDirectionRule} from "./arc-direction.rule";
import {placeTokensRule} from "./place-tokens.rule";
import {actionValidationRule} from "./action-validation.rule";

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