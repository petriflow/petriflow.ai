import type {ValidationRule, ValidationIssue} from "../validation.service";
import {childText, findRootChildren} from "./helpers";

/** Maps root-child tag name -> whether it is a place (vs. a transition). */
function placeIds(doc: any): Set<string> {
  return new Set(
    findRootChildren(doc, "place")
      .map(n => childText(n, "id"))
      .filter(Boolean)
  );
}

function transitionIds(doc: any): Set<string> {
  return new Set(
    findRootChildren(doc, "transition")
      .map(n => childText(n, "id"))
      .filter(Boolean)
  );
}

/**
 * Verifies that an arc always connects a place to a transition (in either
 * direction). Arcs between two places or two transitions are invalid.
 */
export const arcDirectionRule: ValidationRule = {
  name: "arc-direction",
  description: "Disallow arcs between two transitions or between two places.",

  validate(doc) {
    const issues: ValidationIssue[] = [];
    const places = placeIds(doc);
    const transitions = transitionIds(doc);

    const classify = (id: string): "transition" | "place" | "unknown" =>
      transitions.has(id) ? "transition" : places.has(id) ? "place" : "unknown";

    const arcs = findRootChildren(doc, "arc");
    arcs.forEach((arc, index) => {
      const arcId = childText(arc, "id") || `#${index + 1}`;
      const source = childText(arc, "sourceId");
      const destination = childText(arc, "destinationId");

      const src = classify(source);
      const dst = classify(destination);

      if (src === "unknown" || dst === "unknown") {
        // Connectivity is handled by the arc-connectivity rule.
        return;
      }
      if (src === dst) {
        issues.push({
          rule: this.name,
          severity: "error",
          message: `Arc "${arcId}" connects two ${src}s ("${source}" -> "${destination}"). An arc must connect a place to a transition (place -> transition or transition -> place).`
        });
      }
    });

    return issues;
  }
};