import {z} from "zod";
import {InferSchema} from "xmcp";
import petriflowDataService from "../services/petriflow-data.service";
import {withToolFeatureFlag} from "../services/feature-flags.service";

export const schema = {
  version: z.string().describe("Version of the schema"),
};

export const outputSchema = {
  elements: z.array(z.object({
    name: z.string().describe("Name of the element"),
    description: z.string().describe("Description of the element"),
  })).describe("List of elements"),
};

export const metadata = withToolFeatureFlag({
  name: "list_elements",
  description: "List all elements of Petriflow language",
  annotation: {
    title: "List elements of Petriflow language",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
});

export default async function listElements({version}: InferSchema<typeof schema>) {
  const elements = petriflowDataService.listElements(version);
  return {structuredContent: {elements}};
}
