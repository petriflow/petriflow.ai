import type {ValidationRule, ValidationIssue} from "../validation.service";
import {childText, findRootChildren} from "./helpers";

/**
 * Builds the set of ids declared by direct children of the document root for a
 * given tag (e.g. all <transition> and <place> ids).
 */
function idSet(doc: any, tags: string[]): Set<string> {
  const ids = new Set<string>();
  for (const tag of tags) {
    for (const node of findRootChildren(doc, tag)) {
      const id = childText(node, "id");
      if (id) {
        ids.add(id);
      }
    }
  }
  return ids;
}

/**
 * Verifies that every arc references existing transition/place ids via its
 * <sourceId> and <destinationId>. An arc endpoint pointing at an unknown id
 * means the net is not connected.
 */
export const arcConnectivityRule: ValidationRule = {
  name: "arc-connectivity",
  description: "Ensure every arc is connected to existing transitions and places.",

  validate(doc) {
    const issues: ValidationIssue[] = [];
    const knownIds = idSet(doc, ["transition", "place"]);

    const arcs = findRootChildren(doc, "arc");
    arcs.forEach((arc, index) => {
      const arcId = childText(arc, "id") || `#${index + 1}`;
      const sourceId = childText(arc, "sourceId");
      const destinationId = childText(arc, "destinationId");

      if (sourceId && !knownIds.has(sourceId)) {
        issues.push({
          rule: this.name,
          severity: "error",
          message: `Arc "${arcId}": sourceId "${sourceId}" does not reference any existing <transition> or <place>. The arc is not connected.`
        });
      }
      if (destinationId && !knownIds.has(destinationId)) {
        issues.push({
          rule: this.name,
          severity: "error",
          message: `Arc "${arcId}": destinationId "${destinationId}" does not reference any existing <transition> or <place>. The arc is not connected.`
        });
      }
    });

    return issues;
  }
};