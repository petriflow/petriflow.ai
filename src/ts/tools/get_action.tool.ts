import {z} from "zod";
import {InferSchema} from "xmcp";
import petriflowDataService from "../services/petriflow-data.service";
import {withToolFeatureFlag} from "../services/feature-flags.service";

export const schema = {
  version: z.string().describe("Version of the schema"),
  name: z.string().describe("Name of the action"),
};

const actionVariantSchema = z.object({
  name: z.string().optional().describe("Name of the action"),
  description: z.string().describe("Description of the action"),
  signature: z.string().optional().describe("Signature of the action"),
  deprecated: z.boolean().optional().describe("Whether the action or overload is deprecated"),
  params: z.array(z.object({
    name: z.string().describe("Name of the parameter"),
    type: z.string().describe("Type of the parameter"),
    description: z.string().describe("Description of the parameter"),
    required: z.boolean().describe("Whether the parameter is required"),
  }).describe("Parameters of the action")).optional(),
  examples: z.array(z.string()).optional().describe("Examples of the action"),
});

const actionDefinitionSchema = actionVariantSchema.extend({
  dslChain: z.record(z.string(), actionVariantSchema).optional(),
  alts: z.array(actionVariantSchema).optional(),
});

export const outputSchema = {
  action: actionDefinitionSchema
};

export const metadata = withToolFeatureFlag({
  name: "get_action",
  description: "Get complete definition of an action",
  annotation: {
    title: "Get complete definition of an action",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
});

export default async function getAction({name, version}: InferSchema<typeof schema>) {
  const action = petriflowDataService.getAction(version, name);
  return {structuredContent: {action}};
}
