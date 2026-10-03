import type {ValidationRule, ValidationIssue} from "../validation.service";
import {childText, findRootChildren, findLocal, isJavaIdentifier, JAVA_RESERVED_WORDS, GROOVY_RESERVED_WORDS} from "./helpers";

/**
 * Verifies that all identifiers conform to Java-style identifier constraints.
 *
 * Covers:
 *  - element <id> children (transition, place, arc, role, data, mapping)
 *  - <action> id attributes
 *
 * A valid identifier starts with a letter, underscore or `$`, followed by
 * letters, digits, underscores or `$`, and is not a Java reserved keyword.
 */
export const validIdentifiersRule: ValidationRule = {
  name: "valid-identifiers",
  description: "Ensure all ids are valid Java-style identifiers (syntactically and not reserved).",

  validate(doc) {
    const issues: ValidationIssue[] = [];

    const check = (value: string, context: string) => {
      if (!value) {
        return;
      }
      if (!isJavaIdentifier(value)) {
        issues.push({
          rule: this.name,
          severity: "error",
          message: `${context} id "${value}" is not a valid identifier. It must match [A-Za-z_$][A-Za-z0-9_$]* (start with a letter, underscore or "$", followed by letters, digits, underscores or "$").`
        });
      } else if (JAVA_RESERVED_WORDS.has(value) || GROOVY_RESERVED_WORDS.has(value)) {
        issues.push({
          rule: this.name,
          severity: "error",
          message: `${context} id "${value}" is a reserved keyword (Java or Groovy) and cannot be used as an identifier.`
        });
      }
    };

    // Element <id> children.
    for (const tag of ["transition", "place", "arc", "role", "data", "mapping", "function", "i18n", "caseEvents", "processEvents", "transaction"]) {
      for (const node of findRootChildren(doc, tag)) {
        const id = childText(node, "id");
        if (id) {
          check(id, `<${tag}>`);
        }
      }
    }

    // Action id attributes.
    for (const action of findLocal(doc, "action") as any[]) {
      const id = action.attr("id")?.value()?.trim();
      if (id) {
        check(id, "<action>");
      }
    }

    return issues;
  }
};