import type {ValidationRule, ValidationIssue} from "../validation.service";

/**
 * Verifies that every <action> element has a unique `id` attribute across the
 * entire document. The action id is an attribute, not a child element:
 * `<action id="...">`.
 */
export const uniqueActionIdsRule: ValidationRule = {
  name: "unique-action-ids",
  description: "Ensure every action has a unique id attribute.",

  validate(doc) {
    const issues: ValidationIssue[] = [];
    const seen = new Map<string, number>();
    const actions = doc.find("//*[local-name()='action']") as any[];

    actions.forEach((action) => {
      const id = action.attr("id")?.value()?.trim() ?? "";
      if (!id) {
        issues.push({
          rule: this.name,
          severity: "error",
          message: "An <action> element is missing its required id attribute."
        });
        return;
      }
      const count = (seen.get(id) ?? 0) + 1;
      seen.set(id, count);
      if (count > 1) {
        issues.push({
          rule: this.name,
          severity: "error",
          message: `Duplicate action id "${id}". Action ids must be unique across the entire document (this is occurrence #${count}).`
        });
      }
    });

    return issues;
  }
};