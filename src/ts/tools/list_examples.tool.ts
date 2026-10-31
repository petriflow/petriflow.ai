import {z} from "zod";
import {InferSchema} from "xmcp";
import petriflowDataService from "../services/petriflow-data.service";
import {withToolFeatureFlag} from "../services/feature-flags.service";

export const schema = {
  version: z.string().describe("Version of the schema"),
};

export const outputSchema = {
  examples: z.array(z.object({
    name: z.string().describe("Name of the example"),
    app: z.string().describe("Name of the app"),
    description: z.string().describe("Description of the example"),
  })).describe("List of examples"),
};

export const metadata = withToolFeatureFlag({
  name: "list_examples",
  description: "List all examples in Petriflow language",
  annotation: {
    title: "List examples of Petriflow language",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
});

export default async function listExamples({version}: InferSchema<typeof schema>) {
  const examples = petriflowDataService.listExamples(version);
  return {structuredContent: {examples}};
}
