import type {ValidationRule, ValidationIssue} from "../validation.service";
import {findLocal, childText} from "./helpers";
import actionValidationService, {extractFieldRefs, normalizeFieldRefs, CompiledFunction} from "../action-validation.service";
import {logger} from "../logger.service";

/**
 * Validates every Petriflow action (and every custom `<function>`) in a process
 * by compiling its Groovy code against the Petriflow DSL.
 *
 * Because the whole process is available here, this rule also:
 *   - checks that every `f.field` / `t.transition` reference resolves to a
 *     declared `<data>` / `<transition>` element;
 *   - injects process `<function>` definitions so bare (non-DSL) calls resolve;
 *   - validates the `<function>` bodies themselves.
 *
 * This is the "semantic rule" counterpart to the standalone `validate-action`
 * tool. It runs asynchronously (the Groovy daemon is a JVM subprocess).
 */
export const actionValidationRule: ValidationRule = {
  name: "action-validation",
  description: "Compile every action and custom function against the Petriflow DSL, and verify field/transition references.",

  async validate(doc) {
    const issues: ValidationIssue[] = [];

    // --- Gather process context ---
    const fieldIds = new Set(
      [...findLocal(doc, "data")].map((d: any) => childText(d, "id")).filter(Boolean)
    );
    const transitionIds = new Set(
      [...findLocal(doc, "transition")].map((t: any) => childText(t, "id")).filter(Boolean)
    );

    const functions: CompiledFunction[] = [];
    const functionNodes: any[] = [...findLocal(doc, "function")];
    for (const fn of functionNodes) {
      const name = fn.attr("name")?.value()?.trim();
      const body = fn.text()?.trim();
      if (name && body) {
        functions.push({name, body});
      }
    }

    const actionNodes: any[] = [...findLocal(doc, "action")];

    // --- Validate each action ---
    for (const action of actionNodes) {
      const id = action.attr("id")?.value()?.trim() ?? "";
      const path = `<action id="${id}">`;
      const body = action.text() ?? "";

      // 1. Field/transition existence check (Node side).
      for (const ref of extractFieldRefs(body)) {
        const declared = ref.kind === "f" ? fieldIds : transitionIds;
        if (!declared.has(ref.id)) {
          issues.push({
            rule: this.name,
            severity: "error",
            message: `Unknown ${ref.kind === "f" ? "field" : "transition"} "${ref.id}" referenced in action ${id ? `"${id}"` : ""}. No <${ref.kind === "f" ? "data" : "transition"}> with this id exists in the process.`,
            path
          });
        }
      }

      // 2. Compile the action with injected functions.
      const normalized = normalizeFieldRefs(body);
      const result = await actionValidationService.validateWithFunctions(normalized, functions);

      for (const issue of result.issues) {
        issues.push({
          rule: this.name,
          severity: issue.severity,
          message: `Action ${id ? `"${id}"` : ""} does not compile: ${issue.message}`,
          path,
          line: issue.line,
          column: issue.column
        });
      }
    }

    // --- Validate each function body in isolation ---
    for (let i = 0; i < functionNodes.length; i++) {
      const fn = functionNodes[i];
      const name = fn.attr("name")?.value()?.trim() ?? i.toString();
      const body = fn.text()?.trim();
      if (!body) {
        continue;
      }

      const result = await actionValidationService.validateFunction(body);
      for (const issue of result.issues) {
        issues.push({
          rule: this.name,
          severity: issue.severity,
          message: `Function "${name}" does not compile: ${issue.message}`,
          path: `<function name="${name}">`,
          line: issue.line,
          column: issue.column
        });
      }
    }

    // --- Warn about unused functions (best practice) ---
    const allActionBodies = actionNodes.map((a: any) => a.text() ?? "").join("\n");
    for (const fn of functions) {
      // Bare call detection: look for `fnName(` that is not a property access
      // (`x.fnName(`) and not already part of a longer identifier.
      const re = new RegExp(`(?<![\\w.])${escapeRegExp(fn.name)}\\s*\\(`);
      if (!re.test(allActionBodies)) {
        issues.push({
          rule: this.name,
          severity: "warning",
          message: `Function "${fn.name}" is defined but never called from any action.`,
          path: `<function name="${fn.name}">`
        });
      }
    }

    logger.info(`action-validation: validated ${actionNodes.length} action(s), ${functions.length} function(s), ${issues.length} issue(s)`);
    return issues;
  }
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}