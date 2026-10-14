import {z} from "zod";
import {InferSchema} from "xmcp";
import {getLatestVersion} from "../services/utils";
import {getLogger} from "../services/logger.service";
import validationService from "../services/validation.service";

export const schema = {
  version: z.string().describe("Version of the Petriflow language. Use 'latest' to resolve the cached latest version"),
  xml: z.string().describe("The Petriflow process XML to validate"),
};

export const outputSchema = {
  valid: z.boolean().describe("Whether the process XML is valid"),
  issues: z.array(z.object({
    rule: z.string().describe("Identifier of the rule (or 'xsd'/'xml') that produced the issue"),
    severity: z.enum(["error", "warning"]).describe("Severity of the issue"),
    message: z.string().describe("Detailed description of the issue"),
    path: z.string().optional().describe("XPath-like location of the offending element"),
    line: z.number().optional().describe("1-based line number in the XML"),
    column: z.number().optional().describe("1-based column number in the XML"),
  })).describe("List of validation issues"),
};

export const metadata = {
  name: "validate-process",
  description: "Validate a Petriflow process XML against its schema and semantic rules",
  annotation: {
    title: "Validate a Petriflow process XML",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export default async function validateProcess({version, xml}: InferSchema<typeof schema>) {
  if (version === "latest") {
    version = getLatestVersion();
    getLogger().info(`Using cached latest version: ${version}`);
  }

  const result = await validationService.validate(xml, version);

  getLogger().info(`Validation result: ${result.valid ? "valid" : "invalid"} (${result.issues.length} issue(s))`);
  return {structuredContent: result};
}
