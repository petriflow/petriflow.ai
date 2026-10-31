import {z} from "zod";
import {InferSchema} from "xmcp";
import petriflowDataService from "../services/petriflow-data.service";
import {withToolFeatureFlag} from "../services/feature-flags.service";

export const schema = {
  version: z.string().describe("Version of the schema"),
};

export const outputSchema = {
  components: z.array(z.object({
    name: z.string().describe("Identifier of the component definition, pass it to get_component"),
    names: z.array(z.string()).describe("Values of <name> inside <component> that select this component"),
    fieldTypes: z.array(z.string()).describe("Petriflow data field types the component can be used with"),
    description: z.string().describe("What the component renders"),
    whenToUse: z.string().describe("When to choose this component"),
  })).describe("List of components"),
};

export const metadata = withToolFeatureFlag({
  name: "list_components",
  description: "Get list of available field components (the <component> element of a data field or dataRef)",
  annotation: {
    title: "Get list of available field components",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
});

export default async function listComponents({version}: InferSchema<typeof schema>) {
  return {structuredContent: {components: petriflowDataService.listComponents(version)}};
}
