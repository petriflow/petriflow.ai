import {z} from "zod";
import {InferSchema} from "xmcp";
import petriflowDataService from "../services/petriflow-data.service";
import {withToolFeatureFlag} from "../services/feature-flags.service";

export const schema = {
  version: z.string().describe("Version of the schema"),
};

export const outputSchema = {
  actions: z.array(z.object({
    name: z.string().describe("Name of the action function"),
    signature: z.string().describe("Signature of the action function"),
    description: z.string().describe("Description of the action function"),
  })).describe("List of actions functions"),
};

export const metadata = withToolFeatureFlag({
  name: "list_actions",
  description: "Get list of available actions functions",
  annotation: {
    title: "Get list of available actions functions",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
});

export default async function listActions({version}: InferSchema<typeof schema>) {
  return {structuredContent: {actions: petriflowDataService.listActions(version)}};
}
