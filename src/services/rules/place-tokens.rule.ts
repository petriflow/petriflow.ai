import type {ValidationRule, ValidationIssue} from "../validation.service";
import {childText, findRootChildren, parseInteger} from "./helpers";

/**
 * Verifies that a place's <tokens> is a non-negative integer (zero or greater).
 * Negative and floating-point values are rejected.
 */
export const placeTokensRule: ValidationRule = {
  name: "place-tokens",
  description: "Ensure place tokens is a non-negative integer.",

  validate(doc) {
    const issues: ValidationIssue[] = [];

    const places = findRootChildren(doc, "place");
    places.forEach(place => {
      const id = childText(place, "id") || "<unnamed>";
      const tokens = childText(place, "tokens");

      if (!tokens) {
        issues.push({
          rule: this.name,
          severity: "error",
          message: `Place "${id}" is missing its <tokens> value.`
        });
        return;
      }

      const value = parseInteger(tokens);
      if (value === null) {
        issues.push({
          rule: this.name,
          severity: "error",
          message: `Place "${id}" has tokens "${tokens}", which is not a valid integer (negative, fractional or non-numeric values are not allowed).`
        });
        return;
      }

      if (value < 0) {
        issues.push({
          rule: this.name,
          severity: "error",
          message: `Place "${id}" has tokens "${tokens}", which is negative. Tokens must be zero or a positive integer.`
        });
      }
    });

    return issues;
  }
};