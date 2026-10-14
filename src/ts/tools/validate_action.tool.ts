import {z} from "zod";
import {InferSchema} from "xmcp";
import {getLogger} from "../services/logger.service";
import actionValidationService from "../services/action-validation.service";

export const schema = {
  definition: z.string().describe("The Petriflow action definition (Groovy code) to validate"),
};

export const outputSchema = {
  valid: z.boolean().describe("Whether the action definition compiles"),
  issues: z.array(z.object({
    rule: z.string().describe("Identifier of the check that produced the issue"),
    severity: z.enum(["error", "warning"]).describe("Severity of the issue"),
    message: z.string().describe("Detailed description of the issue"),
    line: z.number().optional().describe("1-based line number in the action source"),
    column: z.number().optional().describe("1-based column number in the action source"),
  })).describe("List of validation issues"),
};

export const metadata = {
  name: "validate-action",
  description: "Validate a Petriflow action definition (Groovy code) by compiling it against the Petriflow DSL",
  annotation: {
    title: "Validate a Petriflow action",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export default async function validateAction({definition}: InferSchema<typeof schema>) {
  const result = await actionValidationService.validate(definition);

  getLogger().info(`Action validation result: ${result.valid ? "valid" : "invalid"} (${result.issues.length} issue(s))`);
  return {structuredContent: result};
}
