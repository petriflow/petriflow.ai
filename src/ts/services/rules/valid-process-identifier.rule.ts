import type {ValidationRule} from "../validation.service";
import {classifyProcessIdentifier} from "../process-identifier";
import {childText} from "./helpers";

/**
 * Checks the root process id.
 *
 * Without an application context, a plain Java identifier and a well-formed
 * `<appId>/<processId>` are both accepted. With `ctx.appId`, the id must be
 * scoped to that exact application.
 */
export const validProcessIdentifierRule: ValidationRule = {
  name: "valid-process-identifier",
  description: "Ensure the process id is a safe identifier segment, or scoped to the application as <appId>/<processId>.",

  validate(doc, ctx) {
    const id = childText(doc.root(), "id");
    if (!id) {
      return [{
        rule: this.name,
        severity: "error",
        message: "The document is missing an <id> element."
      }];
    }

    const classified = classifyProcessIdentifier(id);
    if (!classified) {
      return [{
        rule: this.name,
        severity: "error",
        message: `Process id "${id}" is not valid. Start with a letter or digit and use only letters, digits, dots, underscores, or hyphens, or use the form "<appId>/<processId>".`
      }];
    }

    if (ctx.appId) {
      if (classified.kind === "plain") {
        return [{
          rule: this.name,
          severity: "error",
          message: `Process id "${id}" must have the form "${ctx.appId}/<processId>" when validated for application "${ctx.appId}".`
        }];
      }
      if (classified.appId !== ctx.appId) {
        return [{
          rule: this.name,
          severity: "error",
          message: `Process id "${id}" belongs to application "${classified.appId}", not "${ctx.appId}".`
        }];
      }
    }

    return [];
  }
};
