import type {ValidationRule, ValidationIssue} from "../validation.service";

/**
 * Verifies that every <transition> and <place> id is unique within
 * the document. Demonstrates how to add a semantic rule on top of schema validation.
 *
 * The `doc` argument is a libxmljs5 `Document`; use `doc.find(xpath)` to run
 * XPath queries against the parsed process. Each `<id>` is read via `.text()`.
 */
export const uniqueIdsRule: ValidationRule = {
  name: "unique-ids",
  description: "Ensure all transition and place ids are unique.",

  validate(doc) {
    const issues: ValidationIssue[] = [];

    // Locate a given tag's immediate <id> child and check for duplicates.
    const check = (tag: string) => {
      const seen = new Map<string, string>();
      const nodes = doc.find(`/*[local-name()='document']/*[local-name()='${tag}']`);
      nodes.forEach(node => {
        const idNode = (node as any).find?.("./*[local-name()='id']")?.[0];
        const id = idNode?.text()?.trim() ?? "";
        if (!id) {
          issues.push({
            rule: this.name,
            severity: "warning",
            message: `A <${tag}> element has no <id> value. Provide a unique id.`
          });
          return;
        }
        if (seen.has(id)) {
          issues.push({
            rule: this.name,
            severity: "error",
            message: `Duplicate <${tag}> id "${id}" (previous one at ${seen.get(id)}). <${tag}> ids must be unique across the document.`
          });
        } else {
          seen.set(id, "an earlier position");
        }
      });
    };

    check("transition");
    check("place");

    return issues;
  }
};
